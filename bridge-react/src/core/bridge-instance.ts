/**
 * Singleton BridgeAuth instance + Zustand store adapter.
 *
 * This mirrors bridge-svelte's `core/bridge-instance.ts` line-for-line — it is the
 * architectural keystone of the bridge-nextjs ↔ auth-core integration. A single
 * BridgeAuth instance is created on first `initBridge()` call; its events are
 * wired to a Zustand store so React components can subscribe to live updates via
 * the matching `useXxx` hooks in `../client/hooks/`.
 *
 * The store shape and exported function names mirror bridge-svelte 1:1 so feature
 * ports translate cleanly. Reactive primitives differ (Svelte stores → Zustand)
 * but the contract is identical.
 */
import {
  BridgeAuth,
  type AppConfig,
  type AuthState,
  type BridgeAuthConfig,
  type Plan,
  type Profile,
  type SubscriptionStatus,
  type TenantUser,
  type TokenSet,
} from '@nebulr-group/bridge-auth-core';
import { create } from 'zustand';
import { logger } from '../utils/logger';
import type { BridgeConfig } from '../types/config';

// ── Singleton ──────────────────────────────────────────────────────────────────

let _instance: BridgeAuth | null = null;

// ── Resolved plugin config ─────────────────────────────────────────────────────
//
// bridge-react has no config store (unlike bridge-svelte's config.store.ts);
// the resolved config is captured here at init so components can read
// runtime-only fields (e.g. `billing.manageRoute`) after mount.

let _resolvedConfig: BridgeConfig | null = null;

/** @internal — called by `<BridgeProvider>` during init with the resolved config. */
export function setBridgeConfig(config: BridgeConfig): void {
  _resolvedConfig = config;
}

/**
 * The resolved `BridgeConfig` the provider was initialized with, or `null`
 * before `<BridgeProvider>` has mounted — safe to call anywhere (never throws).
 */
export function getBridgeConfig(): BridgeConfig | null {
  return _resolvedConfig;
}

// ── Subscription state shape ──────────────────────────────────────────────────

export interface SubscriptionState {
  status: SubscriptionStatus | null;
  plans: Plan[] | null;
  loading: boolean;
  error: string | null;
}

// ── Zustand store ──────────────────────────────────────────────────────────────
//
// One store holds all reactive state pushed by auth-core events. Hooks in
// ../client/hooks/ select narrow slices via `useBridgeStore(s => s.xxx)`.

interface BridgeStoreState {
  tokens: TokenSet | null;
  appConfig: AppConfig | null;
  profile: Profile | null | undefined; // undefined = loading, null = no profile, Profile = loaded
  flags: Record<string, boolean>;
  authState: AuthState;
  isLoading: boolean;
  error: string | null;
  tenantUsers: TenantUser[];
  ready: boolean;
  subscription: SubscriptionState;
  /**
   * The consumer-configured in-app login route (`config.loginRoute`), captured
   * at `initBridge()`. When set, `<ProtectedRoute>` navigates here via the
   * router adapter (SDK mode) instead of launching the hosted auth portal.
   * `null` = unset → hosted mode (default). Mirrors bridge-svelte's
   * `getConfig().loginRoute` branch in BridgeBootstrap.
   */
  loginRoute: string | null;
}

export const useBridgeStore = create<BridgeStoreState>(() => ({
  tokens: null,
  appConfig: null,
  profile: undefined,
  flags: {},
  authState: 'unauthenticated',
  isLoading: true,
  error: null,
  tenantUsers: [],
  ready: false,
  subscription: { status: null, plans: null, loading: false, error: null },
  loginRoute: null,
}));

// ── Ready gate ─────────────────────────────────────────────────────────────────

let _resolveReady: (() => void) | null = null;
const _readyPromise = new Promise<void>((resolve) => {
  _resolveReady = resolve;
});

// ── App config load gate ───────────────────────────────────────────────────────
//
// The anonymous app config drives SSO button visibility, signup/magic-link
// toggles, etc. on LoginForm. We cache the in-flight fetch so concurrent
// callers share a single network request and can await the result.
let _appConfigPromise: Promise<AppConfig | null> | null = null;

// ── Init / access ──────────────────────────────────────────────────────────────

export function initBridge(config: BridgeAuthConfig): BridgeAuth {
  if (_instance) {
    logger.debug('[bridge-instance] already initialized, returning existing');
    return _instance;
  }

  _instance = new BridgeAuth(config);

  // Seed store from current auth-core state
  const existingTokens = _instance.getTokens();
  if (existingTokens) {
    useBridgeStore.setState({ tokens: existingTokens });
    _instance.getProfile()
      .then((p) => useBridgeStore.setState({ profile: p ?? null }))
      .catch(() => {});
  }
  useBridgeStore.setState({
    authState: _instance.getAuthState(),
    isLoading: false,
    // Capture the in-app login route so <ProtectedRoute> can branch on it
    // (SDK mode → in-app route; unset → hosted portal). `config` is private on
    // BridgeAuth, so we snapshot the resolved value here at init time.
    loginRoute: config.loginRoute ?? null,
  });

  // Wire auth-core events → Zustand store
  _instance.on('auth:login', (tokens) => {
    useBridgeStore.setState({ tokens });
    _instance!.getProfile()
      .then((p) => useBridgeStore.setState({ profile: p ?? null }))
      .catch(() => {});
  });

  _instance.on('auth:logout', () => {
    resetSubscriptionReads();
    useBridgeStore.setState({
      tokens: null,
      profile: null,
      flags: {},
      subscription: { status: null, plans: null, loading: false, error: null },
    });
  });

  _instance.on('auth:token-refreshed', (tokens) => {
    useBridgeStore.setState({ tokens });
  });

  _instance.on('auth:state-change', (state) => {
    useBridgeStore.setState({ authState: state });
    if (state === 'tenant-selection') {
      useBridgeStore.setState({ tenantUsers: _instance!.getTenantUsers() });
    } else if (state === 'authenticated' || state === 'unauthenticated') {
      useBridgeStore.setState({ tenantUsers: [] });
    }
  });

  _instance.on('auth:profile', (profile) => {
    useBridgeStore.setState({ profile });
  });

  _instance.on('auth:workspace-changed', (tokens) => {
    resetSubscriptionReads();
    useBridgeStore.setState({
      tokens,
      flags: {},
      subscription: { status: null, plans: null, loading: false, error: null },
    });
    _instance!.getProfile()
      .then((p) => useBridgeStore.setState({ profile: p ?? null }))
      .catch(() => {});
  });

  _instance.on('auth:error', (err) => {
    useBridgeStore.setState({ error: err.message });
  });

  // Load app config anonymously (drives SSO buttons, signup toggle, etc.).
  // Cached in `_appConfigPromise` so LoginForm (and others) can await the
  // result via `ensureAppConfig()` instead of racing the store update.
  void ensureAppConfig();

  logger.debug('[bridge-instance] initialized');
  return _instance;
}

/**
 * Load the anonymous app config into the store if it isn't already.
 *
 * Idempotent: concurrent callers share the in-flight fetch, and once the
 * store holds a value this function resolves immediately.
 *
 * Resolves with the loaded config on success or `null` on failure (the
 * fetch error is logged — it is not silently swallowed).
 */
export function ensureAppConfig(): Promise<AppConfig | null> {
  const existing = useBridgeStore.getState().appConfig;
  if (existing) return Promise.resolve(existing);
  if (_appConfigPromise) return _appConfigPromise;

  _appConfigPromise = getBridgeAuth()
    .getAppConfig()
    .then((cfg) => {
      useBridgeStore.setState({ appConfig: cfg });
      return cfg;
    })
    .catch((err) => {
      logger.warn('[bridge-instance] getAppConfig failed:', err);
      _appConfigPromise = null;
      return null;
    });

  return _appConfigPromise;
}

export function getBridgeAuth(): BridgeAuth {
  if (!_instance) {
    throw new Error(
      'BridgeAuth not initialized. Wrap your app in <BridgeProvider> first.'
    );
  }
  return _instance;
}

export function markReady(): void {
  if (useBridgeStore.getState().ready) return;
  useBridgeStore.setState({ ready: true });
  _resolveReady?.();
}

export function waitForBridge(): Promise<void> {
  return _readyPromise;
}

// ── Subscription ──────────────────────────────────────────────────────────────
//
// TBP-762 — one refresh rule for the plan list and the current plan (ported
// from bridge-svelte's `core/bridge-instance.ts`).
//
// Every screen used to fetch on its own, so a list loaded once was served for
// the life of the tab: a plan added in Bridge never appeared until a reload.
// Now:
//   - concurrent calls share one read, and a call made while a read is in
//     flight gets a second read after it — the caller asked because something
//     changed, and the in-flight answer may predate that;
//   - a read that fails, or answers with an empty plan list, is retried once;
//   - a background re-read never blanks what is on screen: `loading` is only
//     true while there is nothing to show, and a failed re-read keeps the last
//     good answer instead of replacing it with an error;
//   - an answer that arrives after sign-out or a workspace switch is dropped.
// `core/billing-refresh.ts` decides WHEN to re-read (sign-in renewal, live
// billing events, tab focus after 30 s); this is HOW.

/** Delay before the one retry of a failed or empty read. */
let _retryDelayMs = 1000;
/** @internal — test-only: shorten the retry delay. */
export function __setBillingRetryDelay(ms: number): void {
  _retryDelayMs = ms;
}
/** @internal — the delay before a billing read's one retry. */
export function billingRetryDelay(): number {
  return _retryDelayMs;
}

let _subInflight: Promise<void> | null = null;
let _subAgain = false;
let _subscriptionLoadedAt = 0;
let _subWanted = false;
/** Bumped on sign-out and workspace switch; a read started before is discarded. */
let _subGeneration = 0;

function resetSubscriptionReads(): void {
  _subGeneration += 1;
  _subscriptionLoadedAt = 0;
}

/** When the plan list and status were last read successfully (ms epoch), 0 if never. */
export function subscriptionLoadedAt(): number {
  return _subscriptionLoadedAt;
}

/** True once any screen has asked for the plan list / status in this session. */
export function subscriptionWanted(): boolean {
  return _subWanted;
}

/** Re-read the plan list and the current plan. Never rejects. */
export function loadSubscription(): Promise<void> {
  _subWanted = true;
  if (_subInflight) {
    _subAgain = true;
    return _subInflight;
  }
  _subInflight = (async () => {
    try {
      do {
        _subAgain = false;
        await readSubscriptionOnce();
      } while (_subAgain);
    } finally {
      _subInflight = null;
    }
  })();
  return _subInflight;
}

/**
 * Read the subscription unless the store holds a read younger than `maxAgeMs`
 * (default 30 s) — what the subscription pages call on mount, so moving
 * between them does not re-read every time (mirrors bridge-svelte TBP-762).
 */
export function ensureSubscription(maxAgeMs = 30_000): Promise<void> {
  if (_subInflight) return _subInflight;
  if (_subscriptionLoadedAt > 0 && Date.now() - _subscriptionLoadedAt < maxAgeMs) return Promise.resolve();
  return loadSubscription();
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function readSubscriptionOnce(): Promise<void> {
  const generation = _subGeneration;
  const current = useBridgeStore.getState().subscription;
  const hasData = current.status !== null || current.plans !== null;
  if (!hasData) {
    useBridgeStore.setState((s) => ({ subscription: { ...s.subscription, loading: true, error: null } }));
  }

  for (let attempt = 0; ; attempt++) {
    try {
      const [status, plans] = await Promise.all([
        getBridgeAuth().getSubscriptionStatus(),
        getBridgeAuth().getPlans(),
      ]);
      if (generation !== _subGeneration) return;
      // An empty list is more often a read that raced a change than an app
      // with no plans: ask once more before believing it.
      if ((plans?.length ?? 0) === 0 && attempt === 0) {
        await wait(_retryDelayMs);
        if (generation !== _subGeneration) return;
        continue;
      }
      useBridgeStore.setState({ subscription: { status, plans, loading: false, error: null } });
      _subscriptionLoadedAt = Date.now();
      return;
    } catch (err) {
      if (generation !== _subGeneration) return;
      if (attempt === 0) {
        await wait(_retryDelayMs);
        if (generation !== _subGeneration) return;
        continue;
      }
      const msg = err instanceof Error ? err.message : 'Failed to load subscription';
      logger.warn('[bridge-instance] subscription read failed:', msg);
      const latest = useBridgeStore.getState().subscription;
      if (latest.status !== null || latest.plans !== null) {
        // Keep the last good answer on screen; the next trigger re-reads.
        useBridgeStore.setState((s) => ({ subscription: { ...s.subscription, loading: false } }));
      } else {
        useBridgeStore.setState((s) => ({ subscription: { ...s.subscription, loading: false, error: msg } }));
      }
      return;
    }
  }
}

// ── Stripe checkout return (TBP-723) ──────────────────────────────────────────
//
// On the Stripe return the access token still predates the payment, so its
// `shouldSelectPlan` claim reads true until confirm-checkout has refreshed it.
// auth-core's `shouldRedirectToPaywall()` trusts that claim (TBP-368, zero
// network), so a paywall check taken before the confirmation settles sends a
// paying customer back to the plan picker — and that navigation aborts the
// confirmation itself. bridge-svelte avoids this by ordering: its bootstrap
// confirms the checkout on the callback route and only then enforces the
// paywall. React's confirm (in <CallbackHandler>) and paywall check (in
// <BridgeProvider>) live in different components, so the ordering is kept
// here: the confirmation is registered, and the paywall check waits for it.

let _checkoutConfirmation: { sessionId: string; promise: Promise<void> } | null = null;

/**
 * True when `search` is a Stripe Checkout success return (`?stripe_success`
 * with a `session_id`) — the URL `<PlanSelector>` builds for `success_url`.
 */
export function isStripeCheckoutReturn(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has('stripe_success') && !!params.get('session_id');
}

/**
 * Confirm a completed Stripe Checkout session (auth-core
 * `confirmStripeCheckout`: server-side verify + token refresh) and register it
 * as pending so the paywall check waits for it. Idempotent per session id —
 * a second call joins the first confirmation instead of posting again.
 * Rejects when the confirmation fails; the caller owns the error UX.
 */
export function confirmCheckout(sessionId: string): Promise<void> {
  if (_checkoutConfirmation?.sessionId === sessionId) return _checkoutConfirmation.promise;
  const promise = getBridgeAuth().confirmStripeCheckout(sessionId);
  _checkoutConfirmation = { sessionId, promise };
  return promise;
}

/**
 * Resolves once any registered checkout confirmation has settled (success or
 * failure — never rejects); resolves immediately when none is registered.
 */
export async function settleCheckoutConfirmation(): Promise<void> {
  const pending = _checkoutConfirmation?.promise;
  if (pending) await pending.catch(() => {});
}

// ── Lazy proxy accessor (matches svelte's `auth` export) ──────────────────────

/** Lazy proxy to the BridgeAuth singleton — call methods directly: `auth.getToken()`, `auth.logout()`, etc. */
export const auth: BridgeAuth = new Proxy({} as BridgeAuth, {
  get(_, prop) {
    const instance = getBridgeAuth();
    const value = (instance as any)[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

// ── Internal-only resetters (for tests) ───────────────────────────────────────

/** @internal — reset singleton + store. Used by tests only. Do not call from app code. */
export function _resetBridgeInstance(): void {
  _instance = null;
  _resolvedConfig = null;
  _appConfigPromise = null;
  _checkoutConfirmation = null;
  _subscriptionLoadedAt = 0;
  _subInflight = null;
  _subAgain = false;
  _subWanted = false;
  _subGeneration += 1;
  _retryDelayMs = 1000;
  _resolveReady = null;
  useBridgeStore.setState({
    tokens: null,
    appConfig: null,
    profile: undefined,
    flags: {},
    authState: 'unauthenticated',
    isLoading: true,
    error: null,
    tenantUsers: [],
    ready: false,
    subscription: { status: null, plans: null, loading: false, error: null },
    loginRoute: null,
  });
}

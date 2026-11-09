// TBP-941 — the reads a signed-in page needs before its plan-gated features
// can be drawn, and re-reading them when the session changes.
//
// What went wrong (bridge-react 0.8.1): `<FeatureFlag>` gates on a plan feature
// (`bridge:billing.entitlement.<key> eq true`) read auth-core's entitlements
// store, and nothing ever configured or loaded it. It is fail-closed, so a Pro
// workspace evaluated as "entitled to nothing" and showed "Upgrade to use
// this" on every reload and after every sign-in. It only looked right straight
// after a checkout, because the live `entitlements.changed` push filled it.
// `GET /entitlements` was never requested.
//
// bridge-svelte (TBP-810) configures the store and loads it, with the billing
// state and the flag definitions, before the first render; bridge-nextjs and
// bridge-angular read `/entitlements` when the realtime channel connects. This
// is the React port of the Svelte behaviour: `<BridgeProvider>` waits for these
// reads, each capped at 1.5 s, before it renders a signed-in page, and they are
// read again whenever the session changes (sign-in, workspace switch, a token
// that carries a different plan).

import { useBridge as useBillingBridge } from '@nebulr-group/bridge-auth-core';
import { getBridgeAuth } from './bridge-instance';
import { applyEntitlementsChanged } from './snapshot-stores';
import { logger } from '../utils/logger';

const DEFAULT_API_BASE_URL = 'https://api.thebridge.dev';

/** Longest the first render waits for one startup read before showing anyway. */
export const FIRST_RENDER_WAIT_MS = 1500;

/** A stored token this close to expiry is renewed before the startup reads. */
const EXPIRY_SKEW_MS = 30_000;

/** Wait for `work`, but never longer than `ms`. Never rejects. */
export async function withinWait(work: Promise<unknown>, ms: number = FIRST_RENDER_WAIT_MS): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, ms);
  });
  try {
    await Promise.race([work.catch(() => undefined), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function claimsOf(token: string | null | undefined): Record<string, unknown> | null {
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    return JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function workspaceOf(token: string | null | undefined): string | null {
  const tid = claimsOf(token)?.tid;
  return typeof tid === 'string' ? tid : null;
}

/**
 * The handler that renews an out-of-date sign-in (TBP-762). Kept here rather
 * than imported from the runtime, which imports this module.
 */
function tokenStaleHandler(): (() => Promise<string | null>) | undefined {
  try {
    const auth = getBridgeAuth() as ReturnType<typeof getBridgeAuth> & {
      tokenStaleHandler?: () => () => Promise<string | null>;
    };
    return typeof auth.tokenStaleHandler === 'function' ? auth.tokenStaleHandler() : undefined;
  } catch {
    return undefined;
  }
}

function currentToken(): string | null {
  try {
    return getBridgeAuth().getApiContext().accessToken ?? null;
  } catch {
    return null;
  }
}

/**
 * Wire auth-core's entitlements store to this app, so it can load itself and
 * recover on its own (auth-core TBP-686) instead of answering "no" for every
 * key forever. The token is read lazily, so a renewal needs no reconfigure.
 * Idempotent.
 */
export function configureEntitlementsStore(): void {
  try {
    const auth = getBridgeAuth();
    useBillingBridge().entitlementsStore.configure(
      {
        apiBaseUrl: auth.getApiContext().apiBaseUrl ?? DEFAULT_API_BASE_URL,
        getAccessToken: () => currentToken(),
      },
      logger,
    );
  } catch (err) {
    logger.debug('[bridge-startup] entitlements store not configured:', err);
  }
}

// ── The plan's features (`GET /entitlements`) ────────────────────────────────

let _entInflight: Promise<void> | null = null;
let _entAgain = false;

/**
 * Read the workspace's plan features and write them to both copies: auth-core's
 * store (what flag rules on `bridge:billing.entitlement.*` read) and
 * `bridge.tenant.entitlements` (`useEntitlements()`). The current map stays in
 * place until the new one arrives, so a re-read never flashes "locked".
 * Concurrent calls share one read; a call during a read queues one more.
 * Never rejects.
 */
export function readEntitlements(): Promise<void> {
  if (_entInflight) {
    _entAgain = true;
    return _entInflight;
  }
  _entInflight = (async () => {
    try {
      do {
        _entAgain = false;
        await readEntitlementsOnce();
      } while (_entAgain);
    } finally {
      _entInflight = null;
    }
  })();
  return _entInflight;
}

async function readEntitlementsOnce(): Promise<void> {
  let token = currentToken();
  if (!token || typeof globalThis.fetch !== 'function') return;
  let apiBaseUrl = DEFAULT_API_BASE_URL;
  let appId = '';
  try {
    const ctx = getBridgeAuth().getApiContext();
    apiBaseUrl = ctx.apiBaseUrl ?? DEFAULT_API_BASE_URL;
    appId = ctx.appId ?? '';
  } catch {
    return;
  }
  const url = `${apiBaseUrl.replace(/\/+$/, '')}/entitlements`;
  try {
    const get = (bearer: string) =>
      globalThis.fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${bearer}`, 'x-app-id': appId } });
    let res = await get(token);
    if (res.status === 401) {
      // TBP-762 — right after a checkout Bridge marks the sign-in out of date;
      // renew it once and retry, as the billing and quota reads do.
      const renew = tokenStaleHandler();
      const fresh = renew ? await renew() : null;
      if (!fresh) return;
      token = fresh;
      res = await get(token);
    }
    if (!res.ok) return;
    const body = (await res.json()) as { entitlements?: unknown } | null;
    const map = body?.entitlements;
    if (!map || typeof map !== 'object' || Array.isArray(map)) return;
    // Signed out, or switched workspace, while this was in flight.
    if (workspaceOf(currentToken()) !== workspaceOf(token)) return;
    useBillingBridge().entitlementsStore.applyEntitlementsChanged(map as Record<string, boolean>);
    applyEntitlementsChanged({ entitlements: map });
  } catch (err) {
    // Best-effort: the next session change, push or reconnect repairs it.
    logger.debug('[bridge-startup] entitlements read skipped:', err);
  }
}

// ── The billing state (`GET /billing/state`) ─────────────────────────────────

/**
 * Read the workspace's billing state into auth-core's subscription store (what
 * `bridge:billing.plan` rules, `<BridgeBillingNotice>` and
 * `<BridgeSubscriptionStatus>` read). Never rejects.
 */
export async function readBillingState(): Promise<void> {
  try {
    const ctx = getBridgeAuth().getApiContext();
    if (!ctx.accessToken) return;
    await useBillingBridge().subscription.mount(
      {
        apiBaseUrl: ctx.apiBaseUrl ?? DEFAULT_API_BASE_URL,
        accessToken: ctx.accessToken,
        appId: ctx.appId,
        onTokenStale: tokenStaleHandler(),
      },
      logger,
    );
  } catch (err) {
    logger.debug('[bridge-startup] billing state read skipped:', err);
  }
}

/** Re-read what a new session is entitled to. Never rejects. */
export async function reloadSessionBilling(): Promise<void> {
  await Promise.all([readEntitlements(), readBillingState()]);
}

// ── Before the first render ──────────────────────────────────────────────────

/**
 * The startup reads, for a page that loads signed in: the plan's features, the
 * billing state and the flag definitions, all at once, each capped at
 * {@link FIRST_RENDER_WAIT_MS}. A stored token that has expired (a visit after
 * a long break) is renewed first, so the reads do not fail on it. Resolves
 * immediately when signed out. Never rejects.
 */
export async function loadBeforeFirstRender(definitions?: Promise<unknown>): Promise<void> {
  configureEntitlementsStore();
  let token = currentToken();
  if (!token) return;

  const exp = claimsOf(token)?.exp;
  if (typeof exp === 'number' && exp * 1000 <= Date.now() + EXPIRY_SKEW_MS) {
    try {
      await withinWait(getBridgeAuth().refreshTokens());
    } catch {
      // Not initialised — nothing to renew with.
    }
    token = currentToken();
    if (!token) return;
  }

  const reads: Promise<unknown>[] = [withinWait(readEntitlements()), withinWait(readBillingState())];
  if (definitions) reads.push(withinWait(definitions));
  await Promise.all(reads);
}

/** Test-only. */
export function __resetStartupReadsForTests(): void {
  _entInflight = null;
  _entAgain = false;
}

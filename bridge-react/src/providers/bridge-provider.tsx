import { FC, ReactNode, useEffect, useRef, useState } from 'react';
import { BridgeConfig } from '../types/config';
import {
  ensureAppConfig,
  getBridgeAuth,
  getBridgeConfig,
  initBridge,
  isStripeCheckoutReturn,
  markReady,
  settleCheckoutConfirmation,
  setBridgeConfig,
} from '../core/bridge-instance';
import { startBridgeRuntime, stopBridgeRuntime } from '../core/bridge-runtime';
import { createBridgeFlags, type BridgeFlagsBundle } from '../flags/bootstrap';
import { RealtimeDevBadge } from '../components/developer/RealtimeDevBadge';
import { getRouterAdapter } from '../utils/router-adapter';
import { logger, setLoggerDebug } from '../utils/logger';
import type { BridgeAuthConfig } from '@nebulr-group/bridge-auth-core';
import { resolveBridgeConfig } from '../core/resolve-config';
import { appUsesBilling, billingRoutes, isPaywallExempt } from '../core/billing-routes';
import { installQuotaObserver, uninstallQuotaObserver } from '../core/bridge-fetch';
import { BridgeUpgradeMount } from '../components/subscription/BridgeUpgradeMount';

interface BridgeProviderProps {
  /** Your bridge application ID - can be provided directly or via config */
  appId?: string;
  /** Full bridge configuration object */
  config?: BridgeConfig;
  children: ReactNode;
}

const DEFAULT_CALLBACK_PATH = '/auth/oauth-callback';

/**
 * Pathname of the resolved auth callback URL — where <CallbackHandler> (and
 * the Stripe checkout return) lives. Falls back to the default path.
 */
function callbackPath(): string {
  const callbackUrl = getBridgeConfig()?.callbackUrl;
  if (callbackUrl) {
    try {
      return new URL(callbackUrl, window.location.origin).pathname;
    } catch {
      /* malformed — fall through to the default */
    }
  }
  return DEFAULT_CALLBACK_PATH;
}

/**
 * Build the config the core runtime is initialized with (TBP-743): every field
 * resolves as explicit option > environment (`VITE_BRIDGE_*`, then
 * `REACT_APP_BRIDGE_*`) > default — the same rule as every Bridge plugin.
 * Throws, naming `VITE_BRIDGE_APP_ID`, when no app id is found anywhere.
 */
function buildAuthConfig(appId: string | undefined, config: BridgeConfig | undefined): BridgeConfig & BridgeAuthConfig {
  const explicit: BridgeConfig = appId ? { ...config, appId } : { ...config };
  const resolved = resolveBridgeConfig(explicit);
  const defaultCallback =
    typeof window !== 'undefined' ? `${window.location.origin}${DEFAULT_CALLBACK_PATH}` : undefined;
  return {
    defaultRedirectRoute: '/',
    debug: false,
    ...(defaultCallback ? { callbackUrl: defaultCallback } : {}),
    ...resolved,
  };
}

/**
 * Main provider for bridge functionality.
 *
 * Mounts the unified Bridge core runtime (auth-core `BridgeAuth` singleton +
 * realtime channel + `session.snapshot` fanout + Feature Flags 2.0). The core
 * runtime powers the `bridge` unified surface, `useBridge()`, `useFlag()`,
 * `<FeatureFlag flagKey>`, and the redirect/hosted-auth hooks (`useAuth`,
 * `useBridgeToken`) — all of which read directly from the auth-core singleton,
 * so no React context wrapper is required.
 *
 * **Init timing.** `initBridge()` is called synchronously during the first
 * client render — NOT inside `useEffect` — so any child that calls
 * `getBridgeAuth()` during its own effect finds the singleton ready. Init is
 * idempotent and guarded by a ref. Mirrors bridge-nextjs's `<BridgeProvider>`.
 *
 * Configuration priority (highest to lowest), TBP-743:
 * 1. Options passed explicitly (`config`, `appId`)
 * 2. Environment variables (`VITE_BRIDGE_*`, then `REACT_APP_BRIDGE_*`)
 * 3. Default values
 *
 * It also mounts the upgrade dialog (a backend's `402 QUOTA_EXCEEDED` or
 * `402 FEATURE_NOT_IN_PLAN`, and `<FeatureFlag upgrade>` clicks) and the
 * default paywall redirect to `/subscription/plan`; see `BridgeConfig.billing`.
 *
 * @example
 * // Recommended: env vars (VITE_BRIDGE_APP_ID / VITE_BRIDGE_API_BASE_URL)
 * import { BridgeProvider } from '@nebulr-group/bridge-react';
 *
 * <BridgeProvider>
 *   <App />
 * </BridgeProvider>
 *
 * @example
 * // Using the appId prop
 * <BridgeProvider appId="your-app-id">
 *   <App />
 * </BridgeProvider>
 */
export const BridgeProvider: FC<BridgeProviderProps> = ({ appId, config, children }) => {
  const initedRef = useRef(false);
  const flagsBundleRef = useRef<BridgeFlagsBundle | null>(null);
  // Resolved once: explicit option > environment > default (TBP-743).
  const [boot] = useState<{ config: (BridgeConfig & BridgeAuthConfig) | null; error: string | null }>(() => {
    try {
      return { config: buildAuthConfig(appId, config), error: null };
    } catch (err) {
      return { config: null, error: err instanceof Error ? err.message : String(err) };
    }
  });
  const bootError = boot.error;

  // Synchronous client-side init of the unified core runtime. Runs once.
  if (typeof window !== 'undefined' && !initedRef.current && boot.config) {
    const authConfig = boot.config;
    initedRef.current = true;
    setLoggerDebug(!!authConfig.debug);

    if (typeof sessionStorage !== 'undefined') {
      try {
        const sessionId = new URL(window.location.href).searchParams.get('session_id');
        if (sessionId) sessionStorage.setItem('bridge_checkout_session_id', sessionId);
      } catch {
        /* sessionStorage may be disabled — non-fatal */
      }
    }

    initBridge(authConfig);
    // Capture the resolved config so components can read runtime-only
    // fields (e.g. `billing.manageRoute`) via `getBridgeConfig()`.
    setBridgeConfig(authConfig);
    markReady();
    // Mount the core Bridge runtime (realtime channel + session.snapshot
    // fanout + dev-attribute provider). Idempotent; reads appId/apiBaseUrl
    // from the BridgeAuth API context populated by initBridge() above.
    startBridgeRuntime();
    // Mount Feature Flags 2.0 ON TOP OF the core runtime — must run AFTER
    // startBridgeRuntime() so the flag cache attaches to the shared realtime
    // channel (no second websocket). Guarded so a standalone harness doesn't
    // crash bootstrap.
    try {
      flagsBundleRef.current = createBridgeFlags();
    } catch (err) {
      logger.debug('[BridgeProvider] feature flags bootstrap skipped:', err);
    }
    // TBP-743 — level 0 of the plan-limit UI: a 402 from the app's backend
    // opens the upgrade dialog with no code on the page.
    installQuotaObserver();
    logger.debug('[BridgeProvider] core runtime bootstrap complete', authConfig);
  }

  // Refuses to start without an app id, and says which variable to set. The
  // children still render (a public landing page keeps working); anything that
  // needs Bridge fails loudly the same way.
  useEffect(() => {
    if (bootError) logger.error(bootError);
  }, [bootError]);

  // Own the runtime's mounted lifetime: (re)start on mount, flush the realtime
  // client + token subscriptions on unmount.
  //
  // The start above happens during render so children can read the singleton in
  // their own effects — but render runs ONCE while effects can run many times.
  // Under React 18/19 StrictMode the dev-only double-invoke simulates a full
  // mount → unmount → remount on the same fiber: the cleanup below fires, but
  // the component does NOT re-render, so `initedRef` still reads "initialized"
  // and nothing would ever restart what the cleanup tore down. The result was a
  // dev-only dead runtime — no realtime channel, no session.snapshot fanout, no
  // live flag updates, no token-driven channel rescoping — for the whole page
  // lifetime.
  //
  // So the effect re-asserts the runtime instead of assuming render did it.
  // `startBridgeRuntime()` is idempotent and `flagsBundleRef` is nulled by the
  // cleanup, so on a genuine first mount both calls below are no-ops, and on a
  // StrictMode remount they rebuild exactly what was torn down.
  useEffect(() => {
    if (!initedRef.current) return; // no appId — nothing was ever started

    startBridgeRuntime();
    installQuotaObserver();
    if (!flagsBundleRef.current) {
      try {
        flagsBundleRef.current = createBridgeFlags();
      } catch (err) {
        logger.debug('[BridgeProvider] feature flags bootstrap skipped:', err);
      }
    }

    return () => {
      if (flagsBundleRef.current) {
        void flagsBundleRef.current.stop();
        flagsBundleRef.current = null;
      }
      uninstallQuotaObserver();
      void stopBridgeRuntime();
    };
  }, []);

  // Background: refresh tokens for an already-authenticated session + warm the
  // anonymous app config. Deferred to an effect so it never blocks first paint.
  useEffect(() => {
    if (!initedRef.current) return;
    void (async () => {
      try {
        const bridge = getBridgeAuth();
        if (bridge.isAuthenticated()) {
          await bridge.refreshTokens();
        }
      } catch (err) {
        logger.debug('[BridgeProvider] token refresh skipped:', err);
      }
    })();
    void ensureAppConfig();
  }, []);

  // Paywall redirect — the CSR analogue of bridge-svelte's BridgeBootstrap step
  // 2b and bridge-nextjs's BridgeProvider paywall effect. Runs once on mount,
  // after bootstrap resolves auth. Because bridge-react is pure CSR and the
  // provider sits ABOVE the router (no usePathname/useRouter available here),
  // we read the path from `window.location` and redirect via the router adapter
  // (set by the consumer's <App>, falling back to window.location). The E2E
  // flow enters protected routes via full document navigations, so a single
  // mount-time check is sufficient — the bootstrap re-runs on every full load,
  // exactly like svelte's load() guard.
  //
  // Redirects to the paywall route only when:
  //   - billing.paywallRoute is not `false` (it defaults to /subscription/plan,
  //     and that default applies only to an app that has plans)
  //   - the current path is not the paywall route (no redirect loop) or the
  //     payment-error page (a failed checkout must be readable)
  //   - the current page is not the auth callback route / a Stripe return
  //   - no Stripe checkout confirmation is still in flight
  //   - the tenant is authenticated but has not selected a plan
  //   - the app has not opted out via paymentsAutoRedirect: false
  //
  // TBP-723 — the decision reads the `shouldSelectPlan` claim off the CURRENT
  // access token (auth-core TBP-368, zero network); it does not re-fetch the
  // subscription status. On the Stripe return that token predates the payment
  // and still says "select a plan", so checking here sent the paying customer
  // to the paywall ~20 ms after bootstrap and the navigation aborted
  // <CallbackHandler>'s confirm-checkout. bridge-svelte's bootstrap confirms
  // the checkout on the callback route first and enforces the paywall after;
  // React keeps the same order: the callback route is left to
  // <CallbackHandler>, which confirms (refreshing the token) and then runs the
  // paywall check itself, and anywhere else the check waits for a pending
  // confirmation to settle before reading the token.
  useEffect(() => {
    if (typeof window === 'undefined' || !initedRef.current) return;
    // TBP-743 — the paywall defaults to `/subscription/plan` (served by
    // <BridgeBillingRoutes>), and only for an app that has plans; an explicit
    // `billing.paywallRoute` always applies, and `false` turns it off.
    const routes = billingRoutes();
    const paywallRoute = routes.paywallRoute;
    if (!paywallRoute) return;
    const { pathname, search } = window.location;
    if (isPaywallExempt(pathname, routes)) return;
    if (pathname === callbackPath() || isStripeCheckoutReturn(search)) return;

    let cancelled = false;
    void (async () => {
      try {
        await settleCheckoutConfirmation();
        if (cancelled) return;
        const bridge = getBridgeAuth();
        // shouldRedirectToPaywall (auth-core) bundles the auth check + the
        // shouldSelectPlan/paymentsAutoRedirect decision (TBP-369), shared with
        // bridge-svelte/nextjs/angular.
        const should = await bridge.shouldRedirectToPaywall();
        if (cancelled || !should) return;
        // The plan list is fetched only here, for a workspace that would
        // otherwise be redirected by the default.
        if (routes.paywallIsDefault && !appUsesBilling(await bridge.getPlans())) return;
        if (cancelled) return;
        logger.debug('[BridgeProvider] paywall redirect', paywallRoute);
        getRouterAdapter().replace(paywallRoute);
      } catch (err) {
        // Non-fatal — fail open if the subscription fetch errors.
        logger.debug('[BridgeProvider] paywall check skipped:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // TBP-644 — the "Live updates off — why?" badge, mounted here so every app
  // gets it without code changes. Development builds only (the component
  // checks NODE_ENV); `config.devBadge: false` turns it off there too.
  return (
    <>
      {children}
      <RealtimeDevBadge enabled={config?.devBadge !== false} />
      {initedRef.current ? <BridgeUpgradeMount /> : null}
    </>
  );
};

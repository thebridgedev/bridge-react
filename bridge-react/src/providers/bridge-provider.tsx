import { FC, ReactNode, useEffect, useRef } from 'react';
import { BridgeConfig } from '../types/config';
import { ensureAppConfig, getBridgeAuth, initBridge, markReady } from '../core/bridge-instance';
import { startBridgeRuntime, stopBridgeRuntime } from '../core/bridge-runtime';
import { createBridgeFlags, type BridgeFlagsBundle } from '../flags/bootstrap';
import { getRouterAdapter } from '../utils/router-adapter';
import { logger, setLoggerDebug } from '../utils/logger';
import type { BridgeAuthConfig } from '@nebulr-group/bridge-auth-core';

interface BridgeProviderProps {
  /** Your bridge application ID - can be provided directly or via config */
  appId?: string;
  /** Full bridge configuration object */
  config?: BridgeConfig;
  children: ReactNode;
}

const DEFAULT_API_BASE_URL = 'https://api.thebridge.dev';
const DEFAULT_CALLBACK_PATH = '/auth/oauth-callback';

/**
 * Reads the auth-core runtime config from environment variables.
 * Supports both Create-React-App (`REACT_APP_*`) and Vite (`VITE_*`) prefixes.
 */
function getEnvVar(name: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    const v = process.env[`REACT_APP_${name}`] || process.env[`VITE_${name}`];
    if (v) return v;
  }
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return ((import.meta as any).env as any)[`VITE_${name}`];
  }
  return undefined;
}

/**
 * Build the auth-core `BridgeAuthConfig` the core runtime is initialized with.
 * Env vars take highest priority, then props, then defaults. Mirrors
 * bridge-nextjs's `getConfigFromEnv` + merge, translated to the `VITE_BRIDGE_*`
 * prefix (§5.6).
 */
function buildAuthConfig(appId: string | undefined, config: BridgeConfig | undefined): BridgeAuthConfig {
  const fromProps = appId ? { ...config, appId } : config;
  const defaultCallback =
    typeof window !== 'undefined' ? `${window.location.origin}${DEFAULT_CALLBACK_PATH}` : undefined;

  const envAppId = getEnvVar('BRIDGE_APP_ID');
  const envApiBaseUrl = getEnvVar('BRIDGE_API_BASE_URL');
  const envCallbackUrl = getEnvVar('BRIDGE_CALLBACK_URL');
  const envDefaultRedirect = getEnvVar('BRIDGE_DEFAULT_REDIRECT_ROUTE');
  const envLoginRoute = getEnvVar('BRIDGE_LOGIN_ROUTE');
  const envDebug = getEnvVar('BRIDGE_DEBUG');

  return {
    apiBaseUrl: DEFAULT_API_BASE_URL,
    defaultRedirectRoute: '/',
    debug: false,
    ...(defaultCallback ? { callbackUrl: defaultCallback } : {}),
    ...fromProps,
    ...(envAppId ? { appId: envAppId } : {}),
    ...(envApiBaseUrl ? { apiBaseUrl: envApiBaseUrl } : {}),
    ...(envCallbackUrl ? { callbackUrl: envCallbackUrl } : {}),
    ...(envDefaultRedirect ? { defaultRedirectRoute: envDefaultRedirect } : {}),
    ...(envLoginRoute ? { loginRoute: envLoginRoute } : {}),
    ...(envDebug !== undefined ? { debug: envDebug === 'true' } : {}),
  } as BridgeAuthConfig;
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
 * Configuration priority (highest to lowest):
 * 1. Environment variables (REACT_APP_BRIDGE_* or VITE_BRIDGE_*)
 * 2. Props passed to this provider
 * 3. Default values
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
  // Resolved billing config for the paywall redirect effect. `billing` is a
  // runtime-only field (no env-var derivation) so it comes straight from the
  // `config` prop; captured here so the effect doesn't re-derive it.
  const paywallRoute = config?.billing?.paywallRoute;

  // Synchronous client-side init of the unified core runtime. Runs once.
  if (typeof window !== 'undefined' && !initedRef.current) {
    const authConfig = buildAuthConfig(appId, config);
    if (authConfig.appId) {
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
      logger.debug('[BridgeProvider] core runtime bootstrap complete', authConfig);
    } else {
      logger.warn(
        '[BridgeProvider] No appId provided. Set VITE_BRIDGE_APP_ID (or REACT_APP_BRIDGE_APP_ID) or pass the appId prop.'
      );
    }
  }

  // Flush the realtime client + token subscription on provider unmount.
  useEffect(() => {
    return () => {
      if (flagsBundleRef.current) {
        void flagsBundleRef.current.stop();
        flagsBundleRef.current = null;
      }
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
  // Redirects to the configured paywall route only when:
  //   - billing.paywallRoute is configured
  //   - the current path is not already the paywall route (no redirect loop)
  //   - the tenant is authenticated but has not selected a plan
  //   - the app has not opted out via paymentsAutoRedirect: false
  // getSubscriptionStatus() self-heals after a Stripe round-trip: when a
  // checkout session_id is present (URL or sessionStorage), auth-core syncs the
  // completed session server-side first, so shouldSelectPlan reads false and a
  // freshly-paid user is NOT bounced back to the paywall.
  useEffect(() => {
    if (typeof window === 'undefined' || !paywallRoute) return;
    if (window.location.pathname === paywallRoute) return;

    let cancelled = false;
    void (async () => {
      try {
        const bridge = getBridgeAuth();
        if (!bridge.isAuthenticated()) return;
        const status = await bridge.getSubscriptionStatus();
        if (cancelled) return;
        if (status?.shouldSelectPlan === true && status?.paymentsAutoRedirect !== false) {
          logger.debug('[BridgeProvider] paywall redirect', paywallRoute);
          getRouterAdapter().replace(paywallRoute);
        }
      } catch (err) {
        // Non-fatal — fail open if the subscription fetch errors.
        logger.debug('[BridgeProvider] paywall check skipped:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [paywallRoute]);

  return <>{children}</>;
};

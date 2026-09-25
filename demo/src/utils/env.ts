import type { BridgeConfig } from '@nebulr-group/bridge-react';

interface EnvConfig {
  VITE_BRIDGE_APP_ID?: string;
  VITE_BRIDGE_AUTH_BASE_URL?: string;
  VITE_BRIDGE_HOSTED_URL?: string;
  VITE_BRIDGE_CALLBACK_URL?: string;
  VITE_BRIDGE_DEFAULT_REDIRECT_ROUTE?: string;
  VITE_BRIDGE_LOGIN_ROUTE?: string;
  VITE_BRIDGE_TEAM_MANAGEMENT_URL?: string;
  VITE_BRIDGE_DEBUG?: string;
  VITE_ENVIRONMENT?: string;
}

const runtimeEnv = import.meta.env as unknown as EnvConfig;

/**
 * localStorage key the Playwright harness seeds the app id under. Each
 * Playwright worker drives its own Bridge app, so the id cannot come from a
 * build-time env var shared by every browser context (TBP-721, mirrors
 * bridge-svelte's `bridge:appId`).
 */
const APP_ID_STORAGE_KEY = 'bridge:appId';

/** The backend this demo build targets: `local`, `stage` or `prod`. */
export function getDemoEnvironment(): string {
  return runtimeEnv.VITE_ENVIRONMENT || 'local';
}

function readStoredAppId(): string | undefined {
  try {
    return localStorage.getItem(APP_ID_STORAGE_KEY) || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Demo-only config fields the provider forwards to auth-core but that
 * `BridgeConfig` does not declare. `hostedUrl` is the hosted login portal; the
 * provider spreads its `config` prop into the auth-core config, so setting it
 * here is what points hosted login at the stage portal instead of the SDK's
 * production default.
 */
type DemoBridgeConfig = BridgeConfig & { hostedUrl?: string };

export function getBridgeConfig(): BridgeConfig {
  // NOTE: `<BridgeProvider>` gives `VITE_BRIDGE_APP_ID` priority over this prop,
  // so the harness's per-worker id only takes effect while the env file leaves
  // that key empty — which the tracked `.env.test.stage` / `.env.test.prod` do.
  const appId = readStoredAppId() || runtimeEnv.VITE_BRIDGE_APP_ID;

  if (!appId) {
    throw new Error('VITE_BRIDGE_APP_ID is required. Check your .env file.');
  }

  const config: DemoBridgeConfig = {
    appId,
    // Billing paywall wiring. `billing` is a runtime-only field (no env-var
    // derivation), so the demo sets it here. Mirrors bridge-svelte's
    // `billing.paywallRoute: '/welcome'` + bridge-nextjs's Providers config:
    // authenticated, plan-less users are bounced to the PUBLIC /welcome route
    // (PlanSelector); a failed Stripe confirm lands on /payment-error.
    billing: {
      paywallRoute: '/welcome',
      paymentErrorRoute: '/payment-error',
    },
  };

  if (runtimeEnv.VITE_BRIDGE_AUTH_BASE_URL) {
    config.authBaseUrl = runtimeEnv.VITE_BRIDGE_AUTH_BASE_URL;
  }

  // Prod deliberately resolves the SDK's own production endpoints.
  if (getDemoEnvironment() !== 'prod' && runtimeEnv.VITE_BRIDGE_HOSTED_URL) {
    config.hostedUrl = runtimeEnv.VITE_BRIDGE_HOSTED_URL;
  }

  if (runtimeEnv.VITE_BRIDGE_CALLBACK_URL) {
    config.callbackUrl = runtimeEnv.VITE_BRIDGE_CALLBACK_URL;
  }

  if (runtimeEnv.VITE_BRIDGE_DEFAULT_REDIRECT_ROUTE) {
    config.defaultRedirectRoute = runtimeEnv.VITE_BRIDGE_DEFAULT_REDIRECT_ROUTE;
  }

  if (runtimeEnv.VITE_BRIDGE_LOGIN_ROUTE) {
    config.loginRoute = runtimeEnv.VITE_BRIDGE_LOGIN_ROUTE;
  }

  if (runtimeEnv.VITE_BRIDGE_TEAM_MANAGEMENT_URL) {
    config.teamManagementUrl = runtimeEnv.VITE_BRIDGE_TEAM_MANAGEMENT_URL;
  }

  if (runtimeEnv.VITE_BRIDGE_DEBUG !== undefined) {
    config.debug = runtimeEnv.VITE_BRIDGE_DEBUG === 'true';
  }

  return config;
}

import type { BridgeConfig } from '@nebulr-group/bridge-react';

/**
 * localStorage key the Playwright harness seeds the app id under. Each
 * Playwright worker drives its own Bridge app, so the id cannot come from a
 * build-time env var shared by every browser context (TBP-721, mirrors
 * bridge-svelte's `bridge:appId`).
 */
const APP_ID_STORAGE_KEY = 'bridge:appId';

/** The backend this demo build targets: `local`, `stage` or `prod`. */
export function getDemoEnvironment(): string {
  return (import.meta.env.VITE_ENVIRONMENT as string | undefined) || 'local';
}

function readStoredAppId(): string | undefined {
  try {
    return localStorage.getItem(APP_ID_STORAGE_KEY) || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Demo-only: the e2e suite's per-worker app id. `<BridgeProvider>` reads
 * `VITE_BRIDGE_*` itself (TBP-743); an explicit option wins over them, so the
 * harness id passed here takes effect whatever the env file says.
 */
export function withTestFixtures(config: BridgeConfig): BridgeConfig {
  const appId = readStoredAppId();
  return appId ? { ...config, appId } : config;
}

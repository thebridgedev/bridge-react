// TBP-743 — Bridge starts from `<BridgeProvider>` with no props.
//
// Mirrors bridge-svelte's `resolve-config.ts` (TBP-695). The provider used to
// merge the environment ON TOP of the props, so an explicit `appId` or
// `apiBaseUrl` passed in code lost to whatever `.env` said, and it never
// derived the hosted-pages address: a stage app that set only its API address
// still sent sign-in to production's hosted pages, where its app id does not
// exist. The rule now matches every Bridge plugin: explicit option >
// environment > default, and the hosted pages follow the API address on
// Bridge's own domains.

import type { BridgeConfig } from '../types/config';
import { isDevBuild } from './realtime-dev-badge';
import { logger } from '../utils/logger';

/** Where Bridge's production API lives — the default when no address is set. */
export const PRODUCTION_API_BASE_URL = 'https://api.thebridge.dev';

/** The standard variables Bridge reads, already mapped to config fields. */
export interface BridgeEnv {
  appId?: string;
  apiBaseUrl?: string;
  hostedUrl?: string;
  debug?: string;
  callbackUrl?: string;
  defaultRedirectRoute?: string;
  loginRoute?: string;
}

/**
 * The `VITE_BRIDGE_*` variables of a Vite build.
 *
 * Every access is a literal `import.meta.env.VITE_…` property read on purpose:
 * that is the form Vite statically replaces, including in a library consumed
 * from node_modules. A dynamic key (`env[name]`) would not be replaced. The
 * try/catch covers a non-Vite bundler, where `import.meta.env` is undefined.
 */
function readViteEnv(): BridgeEnv {
  try {
    // `(import.meta as any)` compiles to plain `import.meta`, keeping each
    // read in the exact `import.meta.env.VITE_…` shape Vite replaces.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    return {
      appId: (import.meta as any).env.VITE_BRIDGE_APP_ID,
      apiBaseUrl: (import.meta as any).env.VITE_BRIDGE_API_BASE_URL,
      hostedUrl: (import.meta as any).env.VITE_BRIDGE_HOSTED_URL,
      debug: (import.meta as any).env.VITE_BRIDGE_DEBUG,
      callbackUrl: (import.meta as any).env.VITE_BRIDGE_CALLBACK_URL,
      defaultRedirectRoute: (import.meta as any).env.VITE_BRIDGE_DEFAULT_REDIRECT_ROUTE,
      loginRoute: (import.meta as any).env.VITE_BRIDGE_LOGIN_ROUTE,
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */
  } catch {
    return {};
  }
}

/**
 * The `REACT_APP_BRIDGE_*` variables of a Create React App / webpack build.
 * Literal `process.env.X` reads for the same reason: bundlers substitute that
 * exact text and nothing else.
 */
function readProcessEnv(): BridgeEnv {
  try {
    return {
      appId: process.env.REACT_APP_BRIDGE_APP_ID,
      apiBaseUrl: process.env.REACT_APP_BRIDGE_API_BASE_URL,
      hostedUrl: process.env.REACT_APP_BRIDGE_HOSTED_URL,
      debug: process.env.REACT_APP_BRIDGE_DEBUG,
      callbackUrl: process.env.REACT_APP_BRIDGE_CALLBACK_URL,
      defaultRedirectRoute: process.env.REACT_APP_BRIDGE_DEFAULT_REDIRECT_ROUTE,
      loginRoute: process.env.REACT_APP_BRIDGE_LOGIN_ROUTE,
    };
  } catch {
    return {};
  }
}

/**
 * Read Bridge's variables from the consuming app's build: `VITE_BRIDGE_*`
 * first, then `REACT_APP_BRIDGE_*`. An empty value counts as unset.
 */
export function readBridgeEnv(): BridgeEnv {
  const vite = readViteEnv();
  const cra = readProcessEnv();
  const out: BridgeEnv = {};
  for (const key of Object.keys({ ...vite, ...cra }) as Array<keyof BridgeEnv>) {
    const value = present(vite[key]) ?? present(cra[key]);
    if (value !== undefined) out[key] = value;
  }
  return out;
}

/**
 * The hosted pages for an API address on Bridge's own domains: `api` becomes
 * `auth`, so `api-stage.thebridge.dev` pairs with `auth-stage.thebridge.dev`.
 * Any other host (localhost, self-hosted) cannot be derived.
 */
export function hostedUrlFor(apiBaseUrl: string): string | undefined {
  try {
    const url = new URL(apiBaseUrl);
    const match = /^api(-[a-z0-9-]+)?\.thebridge\.dev$/.exec(url.hostname);
    return match ? `https://auth${match[1] ?? ''}.thebridge.dev` : undefined;
  } catch {
    return undefined;
  }
}

// An empty variable means "not set": Vite loads `KEY=` as '' and the demo's
// tracked .env files use exactly that to stop a key falling through.
function present(value: string | undefined | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** What `resolveBridgeConfig` returns: a `BridgeConfig` with an app id. */
export type ResolvedBridgeConfig = BridgeConfig & { appId: string };

/**
 * Build the effective config: an option passed explicitly wins over the
 * environment, and the environment wins over the built-in default.
 *
 * Refuses to guess: with no app id anywhere it throws, naming the variable to
 * set. An app id with no API address runs against production — the documented
 * shape of a production app — and in a development build it says so once,
 * naming `VITE_BRIDGE_API_BASE_URL`, because a stage or local id against
 * production is the mistake this exists to catch.
 */
export function resolveBridgeConfig(
  options: BridgeConfig = {},
  env: BridgeEnv = readBridgeEnv(),
  dev: boolean = isDevBuild(),
): ResolvedBridgeConfig {
  const appId = present(options.appId) ?? present(env.appId);
  if (!appId) {
    throw new Error(
      '[bridge] No Bridge app id was found. Set VITE_BRIDGE_APP_ID in your .env ' +
        '(plus VITE_BRIDGE_API_BASE_URL for a stage or local app), ' +
        'or pass config={{ appId }} to <BridgeProvider>.',
    );
  }

  const apiBaseUrl = present(options.apiBaseUrl) ?? present(env.apiBaseUrl);
  const hostedUrl =
    present(options.hostedUrl) ?? present(env.hostedUrl) ?? (apiBaseUrl ? hostedUrlFor(apiBaseUrl) : undefined);
  const debug = options.debug ?? (env.debug === undefined ? undefined : env.debug === 'true');

  if (!apiBaseUrl && dev) {
    logger.warn(
      `[bridge] VITE_BRIDGE_API_BASE_URL is not set, so app ${appId} is using production ` +
        `(${PRODUCTION_API_BASE_URL}). Set it if this is a stage or local app.`,
    );
  }
  if (apiBaseUrl && !hostedUrl && dev) {
    logger.warn(
      `[bridge] VITE_BRIDGE_HOSTED_URL is not set and cannot be derived from ${apiBaseUrl}, ` +
        `so sign-in pages will open on production. Set it to this environment's hosted pages.`,
    );
  }

  const resolved: ResolvedBridgeConfig = { ...options, appId };
  if (apiBaseUrl) resolved.apiBaseUrl = apiBaseUrl;
  else delete resolved.apiBaseUrl;
  if (hostedUrl) resolved.hostedUrl = hostedUrl;
  else delete resolved.hostedUrl;
  if (debug !== undefined) resolved.debug = debug;
  for (const key of ['callbackUrl', 'defaultRedirectRoute', 'loginRoute'] as const) {
    const value = present(options[key]) ?? present(env[key]);
    if (value) resolved[key] = value;
  }
  return resolved;
}

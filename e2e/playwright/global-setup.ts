/**
 * Global setup for bridge-react Playwright E2E tests.
 *
 * Runs once before all tests, after Playwright has started (or reused) the demo.
 *
 * ## App id resolution (TBP-721, mirrors bridge-svelte TBP-606)
 *
 * The app id is resolved HERE from the test-data API and seeded into the browser
 * context's localStorage as `bridge:appId`, which the demo passes to
 * <BridgeProvider>. The suite no longer depends on an app id baked into
 * `demo/.env.test.<mode>` — the stage/prod files are tracked and deliberately
 * leave it empty.
 *
 * ## Environment boundary (TBP-721, mirrors bridge-svelte TBP-607)
 *
 * The demo must talk to the SAME backend this run provisions apps on. It is not
 * guaranteed to: `playwright.config.ts` reuses any server already answering on
 * the harness port, whatever `--mode` it was started with. The demo's navbar env
 * pill carries the environment and the app id the SDK actually initialized with;
 * both are asserted below, so a mismatch fails here, once, with the fix spelled
 * out — instead of as dozens of downstream "App not found" failures.
 */

import { chromium, type FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { getCurrentEnvironment, harnessBaseUrl } from './config/environments';
import { createTestDataClientFromEnv } from './utils/test-data-client';

const APP_ID_STORAGE_KEY = 'bridge:appId';
const AUTH_DIR = path.resolve(__dirname, '.auth');
export const BASE_STATE_PATH = path.resolve(AUTH_DIR, 'base-state.json');

type StorageState = {
  cookies: any[];
  origins: { origin: string; localStorage: { name: string; value: string }[] }[];
};

function demoEnvFileForProject(): string {
  return `demo/.env.test.${getCurrentEnvironment()}`;
}

/** Storage state pinning `bridge:appId` on the demo origin. */
function buildAppIdState(appId: string, baseURL: string): StorageState {
  return {
    cookies: [],
    origins: [
      { origin: new URL(baseURL).origin, localStorage: [{ name: APP_ID_STORAGE_KEY, value: appId }] },
    ],
  };
}

/**
 * An app id pinned in the demo env file. `<BridgeProvider>` lets
 * `VITE_BRIDGE_APP_ID` override the id the demo passes in, so a pinned value
 * wins in the browser no matter what global-setup seeds — the suite has to use
 * it too, or the test-data API and the browser would talk about different apps.
 */
function pinnedAppId(): string {
  const fromProcess = (process.env.VITE_BRIDGE_APP_ID || '').trim();
  if (fromProcess) return fromProcess;
  try {
    const file = fs.readFileSync(path.resolve(__dirname, '../..', demoEnvFileForProject()), 'utf8');
    const match = file.match(/^VITE_BRIDGE_APP_ID=(.*)$/m);
    return (match?.[1] || '').trim();
  } catch {
    return '';
  }
}

async function globalSetup(_config: FullConfig) {
  console.log('\n========================================');
  console.log('  bridge-react E2E Global Setup');
  console.log('========================================\n');

  const requiredVars = ['PLAYWRIGHT_TEST_API_KEY'];
  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}. Copy config/.env.test.local.example to config/.env.test.local and fill in the values.`
    );
  }

  const envFile = demoEnvFileForProject();
  const testAppDomain = process.env.APP_DOMAIN || 'BRIDGE_REACT_TEST_DASHBOARD';
  const testAppName = process.env.TEST_APP_NAME || 'Bridge React Test Dashboard';
  const ownerEmail = process.env.TEST_OWNER_EMAIL || 'playwright-e2e@thebridge.io';
  const ownerPassword = process.env.TEST_OWNER_PASSWORD || 'helloworld';
  const baseURL = harnessBaseUrl();
  const testDataClient = createTestDataClientFromEnv(testAppDomain);

  let appId = pinnedAppId();
  if (appId) {
    console.log(`[global-setup] VITE_BRIDGE_APP_ID=${appId} is pinned — using it as-is.`);
  } else {
    try {
      const result = await testDataClient.setupTestApp(
        testAppDomain,
        testAppName,
        ownerEmail,
        ownerPassword,
        baseURL
      );
      appId = (result.appId || '').trim();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Could not provision the Bridge test app for this run.\n` +
          `The test-data API failed with: ${message}\n\n` +
          `Fix one of these:\n` +
          `  • Make the test-data API reachable — check STAGE_TEST_DATA_API_URL / PROD_TEST_DATA_API_URL / ` +
          `LOCAL_TEST_DATA_API_URL and PLAYWRIGHT_TEST_API_KEY in config/.env.test.local\n` +
          `  • Or pin an app id: set VITE_BRIDGE_APP_ID in ${envFile}`
      );
    }
    if (!appId) throw new Error(`setup-test-app returned an empty appId for domain ${testAppDomain}`);

    // setup-test-app derives OAuth config from the single appUrl it is given.
    // Let SDK auth through from any localhost port, and register this run's
    // callback, so the hosted-portal round-trip works on whatever HARNESS_PORT.
    await testDataClient
      .configureApp({
        allowedOrigins: ['http://localhost:*'],
        redirectUris: [`${new URL(baseURL).origin}/auth/oauth-callback`],
        defaultCallbackUri: `${new URL(baseURL).origin}/auth/oauth-callback`,
      })
      .catch((error: Error) => {
        console.warn(`[global-setup] ${testAppDomain}: could not widen OAuth config: ${error.message}`);
      });
  }

  process.env.BRIDGE_TEST_APP_ID = appId;
  process.env.BRIDGE_TEST_OWNER_EMAIL = ownerEmail;
  process.env.BRIDGE_TEST_OWNER_PASSWORD = ownerPassword;
  console.log(`[global-setup] Test app ready: ${appId}`);

  fs.mkdirSync(AUTH_DIR, { recursive: true });
  fs.writeFileSync(BASE_STATE_PATH, JSON.stringify(buildAppIdState(appId, baseURL), null, 2));

  // Load the demo with that app id and check it is serving the right backend.
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ storageState: BASE_STATE_PATH });
    const page = await context.newPage();
    await page.goto(baseURL);

    const pill = page.locator('.env-pill');
    try {
      await pill.waitFor({ timeout: 15_000 });
    } catch (waitError: unknown) {
      throw new Error(
        `The demo at ${baseURL} did not render (no .env-pill in the navbar) with app id ${appId} seeded ` +
          `as localStorage "${APP_ID_STORAGE_KEY}".\n` +
          `Underlying wait: ${waitError instanceof Error ? waitError.message : String(waitError)}`
      );
    }

    const expectedEnv = getCurrentEnvironment();
    const shownEnv = await pill.getAttribute('data-env');
    if (shownEnv !== expectedEnv) {
      throw new Error(
        `The demo at ${baseURL} is serving the "${shownEnv ?? 'unknown'}" environment, ` +
          `but this run targets "${expectedEnv}".\n` +
          `Vite picks the environment from its --mode flag, so the demo must run with ` +
          `--mode test.${expectedEnv} (which loads ${envFile}). Stop the server on ${baseURL} ` +
          `and let Playwright start it, or restart it with that mode.`
      );
    }

    const shownAppId = await pill.getAttribute('data-app-id');
    if (shownAppId !== appId) {
      throw new Error(
        `The demo at ${baseURL} initialized with app id "${shownAppId}", expected ${appId}.\n` +
          `Something is pinning the app id — check VITE_BRIDGE_APP_ID in ${envFile}, ` +
          `demo/.env.local, and any exported VITE_BRIDGE_APP_ID.`
      );
    }
    console.log(`[global-setup] Demo is serving "${shownEnv}" with app id ${appId}`);
    await context.close();
  } finally {
    await browser.close();
  }

  try {
    const purgedCount = await testDataClient.purgeTestAccounts();
    console.log('[global-setup] Purged', purgedCount, 'stale test account(s)');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[global-setup] Warning: Failed to purge test accounts:', message);
  }

  console.log('\n[global-setup] Setup complete\n');
}

export default globalSetup;

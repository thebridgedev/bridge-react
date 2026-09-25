/**
 * Global setup for bridge-react Playwright E2E tests.
 *
 * Runs once before all tests, after Playwright has started (or reused) the demo.
 *
 * ## One Bridge app per worker (TBP-721, ported from bridge-svelte TBP-604)
 *
 * `paymentsAutoRedirect`, `stripeEnabled`, the SSO flags — and the app's plan
 * catalog — live on the **app**, not the tenant. With every worker pointed at one
 * shared app, a test that wrote one of them wrote a value every other worker could
 * read, and the suite raced itself. So this file provisions one app per Playwright
 * worker — idempotent by domain, reused across runs — and writes:
 *
 *   - `.auth/worker-apps.json`       the manifest fixtures resolve their app from
 *   - `.auth/worker-<i>-state.json`  storage state seeding that app's `bridge:appId`
 *   - `.auth/base-state.json`        worker 0's state, the config-level default
 *
 * Worker 0 keeps the unsuffixed domain, so `--workers 1` targets exactly the app
 * this suite has always used.
 *
 * ## App id resolution
 *
 * Ids come from the test-data API and are seeded into the browser's localStorage
 * as `bridge:appId`, which the demo passes to <BridgeProvider>. The tracked
 * `demo/.env.test.stage` / `.env.test.prod` leave VITE_BRIDGE_APP_ID empty; a
 * non-empty value there (or exported) is honoured as a pin for every worker.
 *
 * ## Environment boundary
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
import { PAYWALL_PLAN, TEAM_PLAN } from './fixtures/plans';
import {
  BASELINE_APP_CONFIG,
  workerAppDomain,
  workerAppOwnerEmail,
  workerStorageStatePath,
  writeWorkerApps,
  type WorkerApp,
} from './fixtures/worker-app';
import { createTestDataClientFromEnv, type TestDataClient } from './utils/test-data-client';

const APP_ID_STORAGE_KEY = 'bridge:appId';

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
 * wins in the browser no matter what is seeded — the suite has to use it too,
 * or the test-data API and the browser would talk about different apps.
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

/**
 * A test-data client bound to one worker's app domain. Not built from
 * `getEnvironmentConfig()`: that requires `BRIDGE_TEST_APP_ID`, which does not
 * exist yet while this file provisions the apps that define it.
 */
function clientForDomain(appDomain: string): TestDataClient {
  return createTestDataClientFromEnv(appDomain);
}

/**
 * Provision (or re-resolve) one worker's app and write its storage state.
 * `setup-test-app` is idempotent by domain: the first run creates the app with
 * its seeded plans, every later run just refreshes its config.
 */
async function provisionWorkerApp(
  parallelIndex: number,
  opts: { baseDomain: string; baseName: string; ownerPassword: string; baseURL: string; appIdOverride: string },
): Promise<WorkerApp> {
  // A pinned app id is one app, so every worker shares its (base) domain.
  const appDomain = opts.appIdOverride ? opts.baseDomain : workerAppDomain(opts.baseDomain, parallelIndex);
  // Worker 0 keeps the owner this app has always had (it does not match
  // bridge-api's purge pattern, so the suite's own purge leaves it alone). New
  // worker apps get owners that also stay clear of that pattern.
  const ownerEmail =
    parallelIndex === 0
      ? process.env.TEST_OWNER_EMAIL || 'playwright-e2e@thebridge.io'
      : workerAppOwnerEmail(parallelIndex);
  const appName = parallelIndex === 0 ? opts.baseName : `${opts.baseName} (worker ${parallelIndex})`;

  let appId = opts.appIdOverride;

  if (!appId) {
    const client = clientForDomain(appDomain);
    const result = await client.setupTestApp(appDomain, appName, ownerEmail, opts.ownerPassword, opts.baseURL);
    appId = (result.appId || '').trim();
    if (!appId) throw new Error(`setup-test-app returned an empty appId for domain ${appDomain}`);

    // setup-test-app derives OAuth config from the single appUrl it is given.
    // Let SDK auth through from any localhost port, register this run's callback
    // (the harness port is configurable), and start from the baseline config.
    const callback = `${new URL(opts.baseURL).origin}/auth/oauth-callback`;
    await client
      .configureApp({
        allowedOrigins: ['http://localhost:*'],
        redirectUris: [callback],
        defaultCallbackUri: callback,
        ...BASELINE_APP_CONFIG,
      })
      .catch((error: Error) => {
        console.warn(`[global-setup] ${appDomain}: could not widen OAuth config: ${error.message}`);
      });

    // Every test account is bound to TEAM; without it every `testUser` fixture
    // 404s. Idempotent, and cheap once it exists.
    const team = await client.ensurePlan({ ...TEAM_PLAN });
    if (team.created) console.log(`[global-setup] ${appDomain}: created missing ${TEAM_PLAN.key} plan`);
  }

  const storageStatePath = workerStorageStatePath(parallelIndex);
  fs.mkdirSync(path.dirname(storageStatePath), { recursive: true });
  fs.writeFileSync(storageStatePath, JSON.stringify(buildAppIdState(appId, opts.baseURL), null, 2));

  return { parallelIndex, appId, appDomain, ownerEmail, storageStatePath };
}

/**
 * Create the stable paywall plan (and its Stripe price) on an app ahead of the
 * run, so `welcome-paywall.spec.ts` never creates-then-immediately-checks-out
 * against a price bridge-api is still syncing. Idempotent.
 */
async function warmPaywallPlan(app: WorkerApp): Promise<void> {
  const pk = process.env.STRIPE_TEST_PK || '';
  const sk = process.env.STRIPE_TEST_SK || '';
  if (!pk || !sk) return; // welcome-paywall skips itself without these

  const client = clientForDomain(app.appDomain);
  try {
    await client.configureApp({
      stripeEnabled: true,
      stripePublicKey: pk,
      stripeSecretKey: sk,
      currency: PAYWALL_PLAN.currency,
    });
    const result = await client.ensurePlan(PAYWALL_PLAN.definition);
    if (result.created) console.log(`[global-setup] ${app.appDomain}: created paywall plan ${PAYWALL_PLAN.key}`);
  } catch (error: any) {
    console.warn(
      `[global-setup] ${app.appDomain}: paywall plan warm-up failed (${error.message}) — ` +
        `welcome-paywall will provision it itself.`,
    );
  } finally {
    // Leave the app on the baseline every test is entitled to assume.
    await client.configureApp({ ...BASELINE_APP_CONFIG }).catch(() => {});
  }
}

async function globalSetup(config: FullConfig) {
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
  const baseDomain = process.env.APP_DOMAIN || 'BRIDGE_REACT_TEST_DASHBOARD';
  const baseName = process.env.TEST_APP_NAME || 'Bridge React Test Dashboard';
  const ownerPassword = process.env.TEST_OWNER_PASSWORD || 'helloworld';
  const baseURL = harnessBaseUrl();
  const appIdOverride = pinnedAppId();

  // `config.workers` is the resolved count for this run, so `--workers N` sizes
  // the pool automatically.
  const workerCount = Math.max(1, config.workers || 1);
  if (appIdOverride) {
    console.log(
      `[global-setup] VITE_BRIDGE_APP_ID=${appIdOverride} pins all ${workerCount} worker(s) ` +
        `to one app — app-level settings are shared again for this run.`,
    );
  } else {
    console.log(`[global-setup] Provisioning ${workerCount} worker app(s) from base domain ${baseDomain}...`);
  }

  let workerApps: WorkerApp[];
  try {
    workerApps = await Promise.all(
      Array.from({ length: workerCount }, (_, i) =>
        provisionWorkerApp(i, { baseDomain, baseName, ownerPassword, baseURL, appIdOverride }),
      ),
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not provision the per-worker Bridge apps for this run.\n` +
        `The test-data API failed with: ${message}\n\n` +
        `Fix one of these:\n` +
        `  • Make the test-data API reachable — check STAGE_TEST_DATA_API_URL / PROD_TEST_DATA_API_URL / ` +
        `LOCAL_TEST_DATA_API_URL and PLAYWRIGHT_TEST_API_KEY in config/.env.test.local\n` +
        `  • Or pin an app id: set VITE_BRIDGE_APP_ID in ${envFile} (or export it for this run)`,
    );
  }

  writeWorkerApps(workerApps);
  for (const app of workerApps) {
    console.log(`[global-setup]   worker ${app.parallelIndex}: ${app.appDomain} → ${app.appId}`);
  }

  // Worker 0's app is the one the demo is checked with below, and the one
  // anything reading BRIDGE_TEST_APP_ID falls back to. Workers inherit this env.
  const primary = workerApps[0];
  process.env.BRIDGE_TEST_APP_ID = primary.appId;
  process.env.BRIDGE_TEST_OWNER_EMAIL = primary.ownerEmail;
  process.env.BRIDGE_TEST_OWNER_PASSWORD = ownerPassword;

  const baseStatePath = path.resolve(path.dirname(primary.storageStatePath), 'base-state.json');
  fs.copyFileSync(primary.storageStatePath, baseStatePath);

  // Load the demo with worker 0's app id and check it serves the right backend.
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ storageState: primary.storageStatePath });
    const page = await context.newPage();
    await page.goto(baseURL);

    const pill = page.locator('.env-pill');
    try {
      await pill.waitFor({ timeout: 15_000 });
    } catch (waitError: unknown) {
      throw new Error(
        `The demo at ${baseURL} did not render (no .env-pill in the navbar) with app id ${primary.appId} ` +
          `seeded as localStorage "${APP_ID_STORAGE_KEY}".\n` +
          `Underlying wait: ${waitError instanceof Error ? waitError.message : String(waitError)}`,
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
          `and let Playwright start it, or restart it with that mode.`,
      );
    }

    const shownAppId = await pill.getAttribute('data-app-id');
    if (shownAppId !== primary.appId) {
      throw new Error(
        `The demo at ${baseURL} initialized with app id "${shownAppId}", expected ${primary.appId}.\n` +
          `Something is pinning the app id — check VITE_BRIDGE_APP_ID in ${envFile}, ` +
          `demo/.env.local, and any exported VITE_BRIDGE_APP_ID.`,
      );
    }
    console.log(`[global-setup] Demo is serving "${shownEnv}" with app id ${primary.appId}`);
    await context.close();
  } finally {
    await browser.close();
  }

  // Warm the reusable paywall plan and purge stale accounts, per app. Serial on
  // purpose: the Stripe price sync behind `ensure-plan` is rate limited per
  // Stripe account, and every plugin suite shares that account.
  if (!appIdOverride) {
    for (const app of workerApps) {
      await warmPaywallPlan(app);
    }
  }

  const purgeTargets = appIdOverride ? workerApps.slice(0, 1) : workerApps;
  await Promise.all(
    purgeTargets.map(async (app) => {
      try {
        const purgedCount = await clientForDomain(app.appDomain).purgeTestAccounts();
        if (purgedCount > 0) console.log(`[global-setup] ${app.appDomain}: purged ${purgedCount} stale test account(s)`);
      } catch (error: any) {
        console.warn(`[global-setup] ${app.appDomain}: failed to purge test accounts: ${error.message}`);
      }
    }),
  );

  console.log('\n[global-setup] Setup complete\n');
}

export default globalSetup;

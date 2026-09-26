/**
 * Pre-setup for bridge-react E2E tests. Runs BEFORE Playwright starts the demo.
 *
 * 1. Health-checks the test-data API for the target environment, so a
 *    misconfigured key or an unreachable backend fails here, in one line.
 * 2. Local mode only: writes `demo/.env.test.local` (untracked) pointing the
 *    demo at the local bridge-api.
 *
 * It no longer writes an app id anywhere. global-setup provisions one Bridge app
 * per Playwright worker and seeds each id into the browser's localStorage as
 * `bridge:appId` (TBP-721). `demo/.env.test.stage` / `.env.test.prod` are
 * tracked and hand-maintained — this script must not rewrite them: every run
 * would dirty the checkout and bake in a single app id that overrides the
 * per-worker ones.
 *
 * Usage: bun run e2e/playwright/pre-setup.ts [test.local | test.stage | test.prod]
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import {
  DEFAULT_PROD_API_BASE_URL,
  DEFAULT_STAGE_API_BASE_URL,
} from './config/environments';

const rootDir = path.resolve(__dirname, '../..');
dotenv.config({
  path: path.resolve(rootDir, 'config/.env.test.local'),
  override: false,
});

async function preSetup() {
  const mode = process.argv[2] || 'test.local';
  console.log('[pre-setup] Mode:', mode);

  if (!process.env.PLAYWRIGHT_TEST_API_KEY) {
    throw new Error(
      'PLAYWRIGHT_TEST_API_KEY is not set. Copy config/.env.test.local.example to config/.env.test.local and fill in the values.'
    );
  }

  let testDataApiUrl: string;
  if (mode.includes('prod')) {
    testDataApiUrl = process.env.PROD_TEST_DATA_API_URL || DEFAULT_PROD_API_BASE_URL;
  } else if (mode.includes('stage')) {
    testDataApiUrl = process.env.STAGE_TEST_DATA_API_URL || DEFAULT_STAGE_API_BASE_URL;
  } else {
    testDataApiUrl = process.env.LOCAL_TEST_DATA_API_URL || 'http://localhost:3200';
  }

  const healthRes = await fetch(`${testDataApiUrl}/account/test/playwright/health`, {
    method: 'GET',
    headers: { 'x-playwright-api-key': process.env.PLAYWRIGHT_TEST_API_KEY },
  });
  if (!healthRes.ok) {
    throw new Error(
      `Test data API health check failed at ${testDataApiUrl} (${healthRes.status}). Is bridge-api running?`
    );
  }
  console.log(`[pre-setup] Test data API healthy at ${testDataApiUrl}`);

  if (mode !== 'test.local') {
    console.log(`[pre-setup] Using the tracked demo/.env.${mode} as-is.`);
    console.log('[pre-setup] Done.\n');
    return;
  }

  // Local: the backend URL depends on the developer's slot, so this file is
  // generated rather than tracked. Every key is written, empty where the value
  // is derived, so nothing falls through to demo/.env / demo/.env.local.
  const apiBaseUrl = testDataApiUrl.replace(/\/$/, '');
  const envFile = path.resolve(rootDir, 'demo', '.env.test.local');
  const envContent = [
    '# E2E test env for the LOCAL backend — written by e2e/playwright/pre-setup.ts.',
    '# VITE_BRIDGE_APP_ID stays empty: global-setup seeds a per-worker app id into',
    '# localStorage (`bridge:appId`), and a value here would override it.',
    'VITE_BRIDGE_APP_ID=',
    `VITE_BRIDGE_API_BASE_URL=${apiBaseUrl}`,
    `VITE_BRIDGE_HOSTED_URL=${process.env.LOCAL_HOSTED_URL || 'http://localhost:3091'}`,
    'VITE_ENVIRONMENT=local',
    'VITE_BRIDGE_CALLBACK_URL=',
    'VITE_BRIDGE_AUTH_BASE_URL=',
    'VITE_BRIDGE_DEFAULT_REDIRECT_ROUTE=',
    'VITE_BRIDGE_LOGIN_ROUTE=',
    'VITE_BRIDGE_TEAM_MANAGEMENT_URL=',
    'VITE_BRIDGE_DEBUG=true',
    '',
  ].join('\n');
  fs.writeFileSync(envFile, envContent);
  console.log(`[pre-setup] Wrote ${envFile} (API ${apiBaseUrl})`);
  console.log('[pre-setup] Done.\n');
}

preSetup().catch((err) => {
  console.error('[pre-setup] Fatal:', err.message);
  process.exit(1);
});

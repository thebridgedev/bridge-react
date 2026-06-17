/**
 * Pre-setup for bridge-react E2E tests.
 * Creates/gets the test app and writes VITE_BRIDGE_APP_ID into demo/.env.test.local.
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

const rootDir = path.resolve(__dirname, '../..');
dotenv.config({
  path: path.resolve(rootDir, 'config/.env.test.local'),
  override: false,
});

// The app's callback origin registered with bridge-api. Must match where the
// demo serves (playwright.config.ts webServer). Default port matches the
// bridge-port §7.1 assignment; overridable via HARNESS_PORT / LOCAL_BASE_URL.
const DEMO_PORT = process.env.HARNESS_PORT || '3001';
const APP_URL = process.env.LOCAL_BASE_URL || `http://localhost:${DEMO_PORT}`;

async function preSetup() {
  const mode = process.argv[2] || 'test.local';
  const envFileName = mode === 'test.stage' ? '.env.test.stage' : mode === 'test.prod' ? '.env.test.prod' : '.env.test.local';
  const envFile = path.resolve(rootDir, 'demo', envFileName);

  console.log('[pre-setup] Mode:', mode);
  console.log('[pre-setup] Demo env file:', envFile);

  if (!process.env.PLAYWRIGHT_TEST_API_KEY) {
    throw new Error(
      'PLAYWRIGHT_TEST_API_KEY is not set. Copy config/.env.test.local.example to config/.env.test.local and fill in the values.'
    );
  }

  let testDataApiUrl: string;
  if (mode.includes('prod')) {
    testDataApiUrl = process.env.PROD_TEST_DATA_API_URL || '';
    if (!testDataApiUrl) throw new Error('PROD_TEST_DATA_API_URL required for prod');
  } else if (mode.includes('stage')) {
    testDataApiUrl = process.env.STAGE_TEST_DATA_API_URL || '';
    if (!testDataApiUrl) throw new Error('STAGE_TEST_DATA_API_URL required for stage');
  } else {
    testDataApiUrl = process.env.LOCAL_TEST_DATA_API_URL || 'http://localhost:3200';
  }

  const apiKey = process.env.PLAYWRIGHT_TEST_API_KEY;
  const testAppDomain = process.env.APP_DOMAIN || 'BRIDGE_REACT_TEST_DASHBOARD';
  const testAppName = process.env.TEST_APP_NAME || 'Bridge React Test Dashboard';
  const ownerEmail = process.env.TEST_OWNER_EMAIL || 'playwright-e2e@thebridge.io';
  const ownerPassword = process.env.TEST_OWNER_PASSWORD || 'helloworld';

  const healthRes = await fetch(`${testDataApiUrl}/account/test/playwright/health`, {
    method: 'GET',
    headers: { 'x-playwright-api-key': apiKey },
  });
  if (!healthRes.ok) {
    throw new Error(`Test data API health check failed (${healthRes.status}). Is bridge-api running?`);
  }

  console.log('[pre-setup] Setting up test app...');
  const setupRes = await fetch(`${testDataApiUrl}/account/test/playwright/setup-test-app`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-playwright-api-key': apiKey,
    },
    body: JSON.stringify({
      domain: testAppDomain,
      appName: testAppName,
      ownerEmail,
      ownerPassword,
      appUrl: APP_URL,
    }),
  });

  if (!setupRes.ok) {
    const error = await setupRes.text();
    throw new Error(`Failed to setup test app: ${setupRes.status} ${error}`);
  }

  const result = await setupRes.json();
  const appId = result.appId;

  console.log('[pre-setup] Test app ready, App ID:', appId);

  const demoDir = path.resolve(rootDir, 'demo');
  if (!fs.existsSync(demoDir)) {
    throw new Error(`Demo directory not found: ${demoDir}`);
  }

  let authBaseUrl = '';
  // apiBaseUrl is what the BridgeProvider/auth-core actually consume
  // (VITE_BRIDGE_API_BASE_URL → BridgeAuthConfig.apiBaseUrl). auth-core derives
  // authBaseUrl = `${apiBaseUrl}/auth` and the hosted login URL from it. Without
  // this the demo defaults to the PROD `api.thebridge.dev` / `auth.thebridge.dev`,
  // and SDK + hosted logins against a LOCAL test app fail with "App is
  // unauthenticated". The legacy VITE_BRIDGE_AUTH_BASE_URL key is NOT read by the
  // react provider — apiBaseUrl is the correct hook (matches the svelte demo).
  let apiBaseUrl = '';
  let callbackUrl = `${APP_URL}/auth/oauth-callback`;
  if (mode === 'test.local') {
    apiBaseUrl = testDataApiUrl.replace(/\/$/, '');
    authBaseUrl = process.env.LOCAL_AUTH_BASE_URL || `${apiBaseUrl}/auth`;
  } else if (mode === 'test.stage' && process.env.STAGE_AUTH_BASE_URL) {
    authBaseUrl = process.env.STAGE_AUTH_BASE_URL;
    apiBaseUrl = process.env.STAGE_TEST_DATA_API_URL?.replace(/\/$/, '') || '';
  } else if (mode === 'test.prod') {
    authBaseUrl = ''; // prod uses plugin default
    apiBaseUrl = ''; // prod uses plugin default (api.thebridge.dev)
  }

  let envContent: string;
  if (fs.existsSync(envFile)) {
    envContent = fs.readFileSync(envFile, 'utf-8');
    envContent = envContent.replace(/^VITE_BRIDGE_APP_ID=.*$/m, `VITE_BRIDGE_APP_ID=${appId}`);
    if (apiBaseUrl) {
      if (/^VITE_BRIDGE_API_BASE_URL=/m.test(envContent)) {
        envContent = envContent.replace(/^VITE_BRIDGE_API_BASE_URL=.*$/m, `VITE_BRIDGE_API_BASE_URL=${apiBaseUrl}`);
      } else {
        envContent += `\nVITE_BRIDGE_API_BASE_URL=${apiBaseUrl}`;
      }
    }
    if (authBaseUrl) {
      if (/^VITE_BRIDGE_AUTH_BASE_URL=/m.test(envContent)) {
        envContent = envContent.replace(/^VITE_BRIDGE_AUTH_BASE_URL=.*$/m, `VITE_BRIDGE_AUTH_BASE_URL=${authBaseUrl}`);
      } else {
        envContent += `\nVITE_BRIDGE_AUTH_BASE_URL=${authBaseUrl}`;
      }
    }
    if (callbackUrl) {
      if (/^VITE_BRIDGE_CALLBACK_URL=/m.test(envContent)) {
        envContent = envContent.replace(/^VITE_BRIDGE_CALLBACK_URL=.*$/m, `VITE_BRIDGE_CALLBACK_URL=${callbackUrl}`);
      } else {
        envContent += `\nVITE_BRIDGE_CALLBACK_URL=${callbackUrl}`;
      }
    }
  } else {
    envContent = `# E2E test env — written by pre-setup\nVITE_BRIDGE_APP_ID=${appId}\n`;
    if (apiBaseUrl) envContent += `VITE_BRIDGE_API_BASE_URL=${apiBaseUrl}\n`;
    if (authBaseUrl) envContent += `VITE_BRIDGE_AUTH_BASE_URL=${authBaseUrl}\n`;
    if (callbackUrl) envContent += `VITE_BRIDGE_CALLBACK_URL=${callbackUrl}\n`;
  }

  fs.writeFileSync(envFile, envContent);
  const authNote = authBaseUrl ? `, auth + callback for ${mode}` : '';
  console.log('[pre-setup] Updated', envFile, 'with VITE_BRIDGE_APP_ID' + authNote);
  console.log('[pre-setup] Done.\n');
}

preSetup().catch((err) => {
  console.error('[pre-setup] Fatal:', err.message);
  process.exit(1);
});

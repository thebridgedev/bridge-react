/**
 * Environment configuration for bridge-react Playwright E2E tests.
 * Loaded from config/.env.test.local (see playwright.config.ts).
 */

export interface EnvironmentConfig {
  baseUrl: string;
  authBaseUrl?: string;
  cloudViewsUrl?: string;
  /** Bridge API base URL — used for subscription mocking / probes in E2E. */
  apiBaseUrl: string;
  testDataApiUrl: string;
  testDataApiKey: string;
  appId: string;
  appDomain: string;
  name: 'local' | 'stage' | 'prod';
  isContainer: boolean;
}

/**
 * Public, fixed endpoints for the hosted environments. Defaults rather than
 * required settings, so a clean checkout can run the stage/prod suites without
 * hand-writing config first (TBP-721, mirrors bridge-svelte TBP-606). Override
 * via STAGE_* / PROD_* when pointing the suite at a different backend.
 */
export const DEFAULT_STAGE_API_BASE_URL = 'https://api-stage.thebridge.dev';
export const DEFAULT_PROD_API_BASE_URL = 'https://api.thebridge.dev';

/**
 * Where the demo is served — must agree with `playwright.config.ts`, which
 * starts it on HARNESS_PORT (default 3001) unless LOCAL_BASE_URL overrides.
 */
export function harnessBaseUrl(): string {
  return process.env.LOCAL_BASE_URL || `http://localhost:${process.env.HARNESS_PORT || '3001'}`;
}

function isRunningInContainer(): boolean {
  if (process.env.DOCKER === 'true' || process.env.IN_DOCKER === 'true') return true;
  try {
    require('fs').accessSync('/.dockerenv');
    return true;
  } catch {
    return false;
  }
}

function getServiceUrl(
  serviceName: string,
  containerPort: number,
  hostPort: number,
  isContainer: boolean
): string {
  if (isContainer) return `http://${serviceName}:${containerPort}`;
  return `http://localhost:${hostPort}`;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Required environment variable ${name} is not set. Check config/.env.test.local or CI secrets.`
    );
  }
  return value;
}

export function getEnvironmentConfig(environment: 'local' | 'stage' | 'prod'): EnvironmentConfig {
  const testDataApiKey = requireEnv('PLAYWRIGHT_TEST_API_KEY');
  const appDomain = process.env.APP_DOMAIN || 'BRIDGE_REACT_TEST_DASHBOARD';
  const isContainer = isRunningInContainer();

  const baseUrl = isContainer
    ? getServiceUrl('bridge-react', 3001, 3001, isContainer)
    : harnessBaseUrl();

  const appId = requireEnv('BRIDGE_TEST_APP_ID');

  switch (environment) {
    case 'local': {
      const authBaseUrl = isContainer
        ? getServiceUrl('bridge-api', 3000, 3200, isContainer) + '/auth'
        : process.env.LOCAL_AUTH_BASE_URL || 'http://localhost:3200/auth';
      const cloudViewsUrl = isContainer
        ? getServiceUrl('bridge-cloud-views', 3000, 3091, isContainer)
        : process.env.LOCAL_CLOUD_VIEWS_URL || 'http://localhost:3200/cloud-views';
      const testDataApiUrl = isContainer
        ? getServiceUrl('bridge-api', 3000, 3200, isContainer)
        : process.env.LOCAL_TEST_DATA_API_URL || 'http://localhost:3200';

      return {
        name: 'local',
        baseUrl,
        authBaseUrl,
        cloudViewsUrl,
        apiBaseUrl: testDataApiUrl,
        testDataApiUrl,
        testDataApiKey,
        appId,
        appDomain,
        isContainer,
      };
    }
    case 'stage': {
      const stageTestDataApiUrl = process.env.STAGE_TEST_DATA_API_URL || DEFAULT_STAGE_API_BASE_URL;
      const stageApiBaseUrl = process.env.STAGE_API_BASE_URL || stageTestDataApiUrl;
      return {
        name: 'stage',
        baseUrl,
        authBaseUrl: process.env.STAGE_AUTH_BASE_URL || `${stageApiBaseUrl}/auth`,
        cloudViewsUrl: process.env.STAGE_CLOUD_VIEWS_URL || `${stageApiBaseUrl}/cloud-views`,
        apiBaseUrl: stageApiBaseUrl,
        testDataApiUrl: stageTestDataApiUrl,
        testDataApiKey,
        appId,
        appDomain,
        isContainer: false,
      };
    }
    case 'prod': {
      const prodTestDataApiUrl = process.env.PROD_TEST_DATA_API_URL || DEFAULT_PROD_API_BASE_URL;
      return {
        name: 'prod',
        baseUrl,
        apiBaseUrl: prodTestDataApiUrl,
        testDataApiUrl: prodTestDataApiUrl,
        testDataApiKey,
        appId,
        appDomain,
        isContainer: false,
      };
    }
  }
}

export function getCurrentEnvironment(): 'local' | 'stage' | 'prod' {
  const projectName = process.env.PLAYWRIGHT_PROJECT_NAME || '';
  if (projectName.includes('prod')) return 'prod';
  if (projectName.includes('stage')) return 'stage';
  return 'local';
}

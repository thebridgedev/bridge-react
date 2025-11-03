import type { BridgeConfig } from '@nebulr-group/bridge-react';

interface EnvConfig {
  VITE_BRIDGE_APP_ID?: string;
  VITE_BRIDGE_AUTH_BASE_URL?: string;
  VITE_BRIDGE_CALLBACK_URL?: string;
  VITE_BRIDGE_DEFAULT_REDIRECT_ROUTE?: string;
  VITE_BRIDGE_LOGIN_ROUTE?: string;
  VITE_BRIDGE_TEAM_MANAGEMENT_URL?: string;
  VITE_BRIDGE_DEBUG?: string;
}

const runtimeEnv = import.meta.env as unknown as EnvConfig;

export function getBridgeConfig(): BridgeConfig {
  const appId = runtimeEnv.VITE_BRIDGE_APP_ID;

  if (!appId) {
    throw new Error('VITE_BRIDGE_APP_ID is required. Check your .env file.');
  }

  const config: BridgeConfig = {
    appId
  };

  if (runtimeEnv.VITE_BRIDGE_AUTH_BASE_URL) {
    config.authBaseUrl = runtimeEnv.VITE_BRIDGE_AUTH_BASE_URL;
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


import { createContext, FC, ReactNode, useEffect } from 'react';
import { setDebug } from '../utils/logger';
import { BridgeConfig } from '../types/config';

/**
 * Default configuration values for bridge
 */
const DEFAULT_CONFIG: Partial<BridgeConfig> = {
  authBaseUrl: 'https://api.thebridge.dev/auth',
  teamManagementUrl: 'https://api.thebridge.dev/cloud-views/user-management-portal/users',
  cloudViewsUrl: 'https://api.thebridge.dev/cloud-views',
  defaultRedirectRoute: '/',
  loginRoute: '/login',
  debug: false
};

/**
 * Reads configuration from environment variables
 * Supports both React (REACT_APP_*) and Vite (VITE_*) prefixes
 */
const getConfigFromEnv = (): Partial<BridgeConfig> => {
  const envConfig: Partial<BridgeConfig> = {};

  // Try both REACT_APP_ and VITE_ prefixes
  const getEnvVar = (name: string): string | undefined => {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[`REACT_APP_${name}`] || process.env[`VITE_${name}`];
    }
    // For Vite, also check import.meta.env (cast to any to satisfy TS in library builds)
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      return ((import.meta as any).env as any)[`VITE_${name}`];
    }
    return undefined;
  };

  const appId = getEnvVar('BRIDGE_APP_ID');
  const callbackUrl = getEnvVar('BRIDGE_CALLBACK_URL');
  const authBaseUrl = getEnvVar('BRIDGE_AUTH_BASE_URL');
  const defaultRedirectRoute = getEnvVar('BRIDGE_DEFAULT_REDIRECT_ROUTE');
  const loginRoute = getEnvVar('BRIDGE_LOGIN_ROUTE');
  const teamManagementUrl = getEnvVar('BRIDGE_TEAM_MANAGEMENT_URL');
  const cloudViewsUrl = getEnvVar('BRIDGE_CLOUD_VIEWS_URL');
  const debug = getEnvVar('BRIDGE_DEBUG');

  if (appId) envConfig.appId = appId;
  if (callbackUrl) envConfig.callbackUrl = callbackUrl;
  if (authBaseUrl) envConfig.authBaseUrl = authBaseUrl;
  if (defaultRedirectRoute) envConfig.defaultRedirectRoute = defaultRedirectRoute;
  if (loginRoute) envConfig.loginRoute = loginRoute;
  if (teamManagementUrl) envConfig.teamManagementUrl = teamManagementUrl;
  if (cloudViewsUrl) envConfig.cloudViewsUrl = cloudViewsUrl;
  if (debug !== undefined) envConfig.debug = debug === 'true';

  return envConfig;
};

// Create the context with a default value
export const BridgeConfigContext = createContext<BridgeConfig | null>(null);

interface BridgeConfigProviderProps {
  config?: BridgeConfig;
  children: ReactNode;
}

/**
 * React context provider for bridge configuration
 * 
 * Configuration priority (highest to lowest):
 * 1. Environment variables (REACT_APP_BRIDGE_* or VITE_BRIDGE_*)
 * 2. Props passed to provider (config or appId)
 * 3. Default values
 * 
 * @example
 * // Option 1: Using environment variables only (recommended)
 * // Set REACT_APP_BRIDGE_APP_ID or VITE_BRIDGE_APP_ID in your .env
 * <BridgeConfigProvider>
 *   <App />
 * </BridgeConfigProvider>
 * 
 * @example
 * // Option 2: Using props (still supported)
 * import { BridgeConfigProvider } from '@nebulr-group/bridge-react';
 * 
 * <BridgeConfigProvider config={{
 *   appId: 'your-app-id',
 *   // Other options are optional and will use defaults
 * }}>
 *   <App />
 * </BridgeConfigProvider>
 */
export const BridgeConfigProvider: FC<BridgeConfigProviderProps> = ({ config, children }) => {
  // Merge configs with priority: env vars > props > defaults
  const envConfig = getConfigFromEnv();
  const mergedConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    ...envConfig // Environment variables take highest priority
  } as BridgeConfig;

  useEffect(() => {
    setDebug(!!mergedConfig.debug);
  }, [mergedConfig.debug]);

  return (
    <BridgeConfigContext.Provider value={mergedConfig}>
      {children}
    </BridgeConfigContext.Provider>
  );
};


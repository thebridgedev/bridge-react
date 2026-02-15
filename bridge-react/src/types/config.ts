/**
 * bridge configuration interface
 * 
 * Configuration can be provided via:
 * 1. Environment variables (recommended) - prefixed with REACT_APP_BRIDGE_* or VITE_BRIDGE_*
 * 2. Props passed to BridgeProvider
 * 3. Default values
 * 
 * @example Environment Variables for Create React App
 * ```env
 * REACT_APP_BRIDGE_APP_ID=your-app-id
 * REACT_APP_BRIDGE_AUTH_BASE_URL=https://api.thebridge.dev/auth
 * REACT_APP_BRIDGE_DEBUG=true
 * ```
 * 
 * @example Environment Variables for Vite
 * ```env
 * VITE_BRIDGE_APP_ID=your-app-id
 * VITE_BRIDGE_AUTH_BASE_URL=https://api.thebridge.dev/auth
 * VITE_BRIDGE_DEBUG=true
 * ```
 */
export interface BridgeConfig {
  /**
   * Your bridge application ID
   * @required - Must be provided via env var (REACT_APP_BRIDGE_APP_ID or VITE_BRIDGE_APP_ID) or props
   * @env REACT_APP_BRIDGE_APP_ID or VITE_BRIDGE_APP_ID
   */
  appId?: string;

  /**
   * The URL to redirect to after successful login
   * @default The current origin + '/auth/callback'
   * @env REACT_APP_BRIDGE_CALLBACK_URL or VITE_BRIDGE_CALLBACK_URL
   */
  callbackUrl?: string;

  /**
   * The base URL for bridge auth services
   * @default 'https://api.thebridge.dev/auth'
   * @env REACT_APP_BRIDGE_AUTH_BASE_URL or VITE_BRIDGE_AUTH_BASE_URL
   */
  authBaseUrl?: string;

  /**
   * Route to redirect to after login
   * @default '/'
   * @env REACT_APP_BRIDGE_DEFAULT_REDIRECT_ROUTE or VITE_BRIDGE_DEFAULT_REDIRECT_ROUTE
   */
  defaultRedirectRoute?: string;

  /**
   * Route to redirect to when authentication fails
   * @default '/login'
   * @env REACT_APP_BRIDGE_LOGIN_ROUTE or VITE_BRIDGE_LOGIN_ROUTE
   */
  loginRoute?: string;

  /**
   * URL for the team management portal
   * @default 'https://api.thebridge.dev/cloud-views/user-management-portal/users'
   * @env REACT_APP_BRIDGE_TEAM_MANAGEMENT_URL or VITE_BRIDGE_TEAM_MANAGEMENT_URL
   */
  teamManagementUrl?: string;

  /**
   * Base URL for bridge cloud-views service (feature flags, plan selection, payments, etc.)
   * @default 'https://api.thebridge.dev/cloud-views'
   * @env REACT_APP_BRIDGE_CLOUD_VIEWS_URL or VITE_BRIDGE_CLOUD_VIEWS_URL
   */
  cloudViewsUrl?: string;

  /**
   * Debug mode
   * @default false
   * @env REACT_APP_BRIDGE_DEBUG or VITE_BRIDGE_DEBUG
   */
  debug?: boolean;
}


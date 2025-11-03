// Components
export { Login } from './components/auth/Login';
export { ProtectedRoute } from './components/auth/ProtectedRoute';
export { TokenStatus } from './components/auth/TokenStatus';
export { FeatureFlag } from './components/FeatureFlag';
export { Subscription } from './components/Subscription';
export { Team } from './components/team/Team';

// Hooks
export { useAuth } from './hooks/use-auth';
export { useBridgeConfig } from './hooks/use-bridge-config';
export { useBridgeToken } from './hooks/use-bridge-token';
export { default as useFeatureFlag } from './hooks/use-feature-flag';
export { useProfile } from './hooks/use-profile';
export { useTeamManagement } from './hooks/use-team-management';

// Providers
export { BridgeConfigProvider } from './providers/bridge-config.provider';
export { BridgeProvider } from './providers/bridge-provider';
export { BridgeTokenProvider } from './providers/bridge-token.provider';

// Types
export type { Profile } from './services/profile.service';
export type { TokenSet } from './services/token.service';
export type { BridgeConfig } from './types/config';
export type { RouterAdapter } from './types/router';

// Router adapters
export { getRouterAdapter, resetRouterAdapter, setRouterAdapter } from './utils/router-adapter';
export { createReactRouterAdapter, createTanStackRouterAdapter, createWouterAdapter } from './utils/router-adapters';

// Services (for advanced usage)
export { AuthService } from './services/auth.service';
export { getCachedFlags, isFeatureEnabled, loadFeatureFlags } from './services/feature-flag.service';
export { ProfileService } from './services/profile.service';
export { TeamManagementService } from './services/team-management.service';
export { TokenService } from './services/token.service';


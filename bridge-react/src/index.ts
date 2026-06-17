// ── Redirect / hosted-auth surface ────────────────────────────────────────────
// Coexists with the in-app SDK auth surface below (mirrors bridge-svelte /
// bridge-nextjs which keep both). All ride the new auth-core core now.
export { CallbackHandler, type CallbackHandlerProps } from './components/auth/CallbackHandler';
export { Login } from './components/auth/Login';
export { ProtectedRoute } from './components/auth/ProtectedRoute';
export { TokenStatus } from './components/auth/TokenStatus';

// ── Team (SDK panel) ──────────────────────────────────────────────────────────
// Native in-app team management (rides auth-core's TeamService via the core
// singleton). Hard-replaced the legacy redirect/iframe `<Team />` component.
export { TeamAddUserDialog } from './components/team/TeamAddUserDialog';
export { TeamConfirmDialog } from './components/team/TeamConfirmDialog';
export { TeamEditUserDialog } from './components/team/TeamEditUserDialog';
export { TeamManagementPanel } from './components/team/TeamManagementPanel';
export { TeamProfileForm } from './components/team/TeamProfileForm';
export { TeamUserActionsMenu } from './components/team/TeamUserActionsMenu';
export { TeamUserList } from './components/team/TeamUserList';
export { TeamWorkspaceForm } from './components/team/TeamWorkspaceForm';

// ── SDK Auth ──────────────────────────────────────────────────────────────────
// In-app authentication UI (rides the new core's BridgeAuth). Coexists with the
// redirect-based <Login /> / <CallbackHandler /> hosted-auth surface above —
// mirrors bridge-svelte / bridge-nextjs. Export names match the sibling plugins.
export { ForgotPassword } from './components/sdk-auth/ForgotPassword';
export { LoginForm } from './components/sdk-auth/LoginForm';
export { MagicLink } from './components/sdk-auth/MagicLink';
export { MfaChallenge } from './components/sdk-auth/MfaChallenge';
export { MfaSetup } from './components/sdk-auth/MfaSetup';
export { PasskeyLogin } from './components/sdk-auth/PasskeyLogin';
export { PasskeyRequestSetupLink } from './components/sdk-auth/PasskeyRequestSetupLink';
export { PasskeySetup } from './components/sdk-auth/PasskeySetup';
export { SignupForm } from './components/sdk-auth/SignupForm';
export { SsoButton } from './components/sdk-auth/SsoButton';
export { SsoProviderIcon } from './components/sdk-auth/SsoProviderIcon';
export { TenantSelector } from './components/sdk-auth/TenantSelector';
export { WorkspaceSelector } from './components/sdk-auth/WorkspaceSelector';

// ── SDK Auth shared primitives ────────────────────────────────────────────────
export { Alert } from './components/sdk-auth/shared/Alert';
export { AuthFormWrapper } from './components/sdk-auth/shared/AuthFormWrapper';
export { Spinner } from './components/sdk-auth/shared/Spinner';

// ── Profile ───────────────────────────────────────────────────────────────────
// Hard-replaced the legacy JWKS-decoding ProfileService surface; ProfileName +
// useProfile now ride the new core (auth-core singleton + bridge store).
export { ProfileName } from './components/ProfileName';

// ── Subscription (Billing 2.0) ────────────────────────────────────────────────
// PlanSelector = Stripe-direct path; the Bridge* drop-ins read auth-core's
// billing surface. Both coexist (mirrors bridge-svelte / bridge-nextjs). Hard-
// replaced the legacy redirect-based `<Subscription />` component.
export { PlanSelector } from './components/subscription/PlanSelector';
export {
  BridgeSubscriptionStatus,
  type BridgeSubscriptionStatusProps,
} from './components/subscription/BridgeSubscriptionStatus';
export {
  BridgeBillingNotice,
  type BridgeBillingNoticeProps,
} from './components/subscription/BridgeBillingNotice';
export {
  BridgePaywall,
  type BridgePaywallProps,
} from './components/subscription/BridgePaywall';
export {
  BridgeQuotaBanner,
  type BridgeQuotaBannerProps,
} from './components/subscription/BridgeQuotaBanner';
// Generic BridgeReadable → React adapter the Billing 2.0 components are built on.
export {
  useBridgeReadable,
  useBridgeSnapshot,
  type ReadableLike,
} from './hooks/use-bridge-readable';
export { useSubscription } from './hooks/use-subscription';
// Auth-core Billing 2.0 surface re-exports — the reactive billing factory + the
// pure notice-state derivations + their types.
export {
  useBridge as useBridgeBilling,
  deriveNoticeState,
  deriveSeverity,
} from '@nebulr-group/bridge-auth-core';
export type {
  UseBridgeApi,
  UseBridgeEntitlementsApi,
  BillingEventHandlers,
  BillingGateState,
  BillingSubscriptionStatus as BillingSubscriptionStatusType,
  BillingSeverity,
  PastDueReason,
  BillingPlanRef,
  BillingSubscriptionState,
  BillingSubscriptionSnapshot,
  BillingNoticeState,
  BillingLockedPayload,
  MountOptions,
  QuotaSnapshot,
  EntitlementSnapshot,
} from '@nebulr-group/bridge-auth-core';

// ── Developer (API tokens) ────────────────────────────────────────────────────
export { ApiTokenManagement } from './components/developer/ApiTokenManagement';

// Feature Flags 2.0 — declarative component + reactive hook (registry-backed,
// rides on the core runtime mounted by <BridgeProvider>). Hard-replaced the
// legacy `<FeatureFlag flagName>` / `useFeatureFlag` surface.
export { FeatureFlag, type FeatureFlagProps } from './flags/FeatureFlag';

// Hooks
export { useAuth } from './hooks/use-auth';
export { useBridgeToken } from './hooks/use-bridge-token';
export { useProfile } from './hooks/use-profile';

// ── Unified bridge surface (Live Channel Unification) ─────────────────────────
// Single scoped read surface: `bridge.app` / `bridge.tenant` / `bridge.user` /
// `bridge.attributes` / `bridge.events`. Populated from `session.snapshot` on the
// live channel. Mirrors bridge-svelte / bridge-nextjs's `bridge` export.
export {
  auth,
  ensureAppConfig,
  getBridgeAuth,
  initBridge,
  loadSubscription,
  markReady,
  useBridgeStore,
  waitForBridge,
  type SubscriptionState,
} from './core/bridge-instance';
export { bridge } from './core/bridge';
export { useBridge } from './client/hooks/use-bridge';
export type {
  BridgeSurface,
  BridgeAppSurface,
  BridgeTenantSurface,
  BridgeReadable,
} from './core/bridge';
export type { LazySlice } from './core/lazy-slice';
export type {
  BrandingSnapshot,
  SubscriptionSnapshot,
  UserSnapshot,
  SessionSnapshotData,
} from './core/snapshot-stores';
export { BridgeEventsDispatcher, type BridgeEventHandlers } from './core/events';
// Reactive realtime connection status — surface offline indicators / retry banners.
export { realtimeStatus, useRealtimeStatus } from './core/realtime-status';
export type { ConnectionState } from '@nebulr-group/bridge-auth-core';

// ── Feature Flags 2.0 surface (also available via the `./flags` subpath) ──────
export {
  // Bootstrap + browser storage
  createBridgeFlags,
  BrowserIdentityStorage,
  type CreateBridgeFlagsConfig,
  type BridgeFlagsBundle,
  // Reactive helpers
  useFlag,
  flagStore,
  type FlagStore,
  type FeatureFlagProps as FlagComponentProps,
  // Non-React registry surface
  evaluateFlag,
  setBridgeFlagsInstance,
  getBridgeFlagsInstance,
  notifyFlagChanged,
  notifyAllFlagsChanged,
  subscribeToFlagChanges,
  // Auth-core FF 2.0 re-exports
  BridgeFlags,
  MemoryIdentityStorage,
  attachIdentity,
  generateAnonymousId,
  BRIDGE_CONTEXT_HEADER,
  serializeContext,
  deserializeContext,
  serverInstanceId,
  type CachedFlag,
  type FlagValueType,
  type FlagEvalResult,
  type EvalTelemetry,
  type DiscoveryTelemetry,
  type BridgeFlagsHooks,
  type DeclaredAttributeType,
  type AttributeDeclaration,
  type BridgeFlagsMode,
  type EvalContext,
  type IdentityStorage,
  type AnonymousTrackingMode,
  type BridgeIdentity,
  type RealtimeMessage,
} from './flags';

// ── Logger ────────────────────────────────────────────────────────────────────
export { logger, setLoggerDebug } from './utils/logger';

// ── Conversion tracking (Reddit / GA4 via GTM dataLayer) ─────────────────────
// Framework-agnostic; invoked from app code (e.g. after signup). Mirrors
// bridge-svelte / bridge-nextjs.
export {
  configureRedditTracking,
  pushConversionEvent,
  pushRedditEvent,
  type PushConversionEventOptions,
  type RedditConversionEvent,
  type RedditEcommerce,
  type RedditEcommerceItem,
  type RedditTrackingGate,
  type RedditUserData,
} from './client/tracking/reddit-tracking';
export { sha256Email } from './client/tracking/pii-hashing';

// Providers
export { BridgeProvider } from './providers/bridge-provider';

// Types
export type { Profile, TokenSet } from '@nebulr-group/bridge-auth-core';
export type {
  TeamProfile,
  TeamProfileUpdateInput,
  TeamUser,
  TeamUserListResult,
  TeamUserUpdateInput,
  TeamWorkspace,
  TeamWorkspaceUpdateInput,
} from '@nebulr-group/bridge-auth-core';
export type { BridgeConfig } from './types/config';
export type { RouterAdapter } from './types/router';

// Router adapters
export { getRouterAdapter, resetRouterAdapter, setRouterAdapter } from './utils/router-adapter';
export { createReactRouterAdapter, createTanStackRouterAdapter, createWouterAdapter } from './utils/router-adapters';

// Services (re-exported from auth-core for advanced usage)
export { TeamService } from '@nebulr-group/bridge-auth-core';
// API-token service re-exported from auth-core (powers <ApiTokenManagement />).
export { ApiTokenService, type ApiToken, type CreateApiTokenInput } from '@nebulr-group/bridge-auth-core';


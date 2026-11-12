/**
 * @nebulr-group/bridge-react
 *
 * The Bridge for React: sign-in in your own pages, workspaces, flags and
 * route guards, plans and checkout, the team panel and Live updates, on one
 * setting, the issuer. The default look is in `@nebulr-group/bridge-react/styles`.
 */

// Setting up
export { BridgeProvider } from './components/BridgeProvider.js';
export type { BridgeProviderProps } from './components/BridgeProvider.js';
export type { BridgeConfig, BridgeMessages, FlagRequirement, ResolvedConfig, RouteRule } from './core/config.js';
export { bridgeClient, bridgeConfig, getBridge, getConfig } from './core/client.js';
export { AUTH_PAGES, BILLING_PAGES } from './core/routes.js';
export type { AuthPage, BillingPage } from './core/routes.js';
export { decide, findRule, flagsAllow } from './core/guard.js';
export type { GuardDecision, GuardInput } from './core/guard.js';
export { browserRouter, navigate } from './core/router.js';
export type { BridgeLocation, BridgeRouter } from './core/router.js';
export type { Watchable } from './core/value.js';

// State
export {
	useBilling,
	useBridge,
	useBridgeConfig,
	useBridgeRouter,
	useCanManageBilling,
	useCanManageTeam,
	useFlag,
	useFlags,
	useFlagsStatus,
	useLiveStatus,
	useMe,
	usePlans,
	useResource,
	useSession,
	useSignedIn,
	useTranslator,
	useUpgradeRequest,
	useUsage,
	useUser,
	useWatch,
	useWorkspace,
	useWorkspaces,
} from './react/hooks.js';
export type { CurrentWorkspace, ResourceState } from './react/hooks.js';
export { billing, me, plans, resource, usage, workspaces } from './core/resources.js';
export type { Resource, ResourceStore } from './core/resources.js';

// Flags
export { canManageBilling, canManageTeam, requireFlag } from './core/flags.js';

// Calling your API
export { bridgeFetch } from './core/fetch.js';
export { closeUpgrade, openUpgrade, readPaymentRequired, upgradeRequest } from './core/upgrade.js';
export type { UpgradeDialogProps, UpgradeRequest } from './core/upgrade.js';

// Hand-off mode
export { handoffSignIn, readHandoff, returnToProgram } from './core/handoff.js';
export type { HandoffState } from './core/handoff.js';

// Copy
export { errorMessage, translator } from './core/i18n.js';
export type { BridgeMessageKey, BridgeTranslator } from './core/i18n.js';
export type { PluginMessageKey } from './core/messages.js';

// The few auth-core names app code needs to use this package
export { BridgeError, isBridgeError, STANDARD_FLAGS } from '@nebulr-group/bridge-auth-core';
export type { Bridge, BridgeErrorKind, SessionState, SessionUser, SessionWorkspace } from '@nebulr-group/bridge-auth-core';

// Components
export { Link } from './components/shared/Link.js';
export type { LinkProps } from './components/shared/Link.js';
export { BridgeAuthRoutes } from './components/auth/BridgeAuthRoutes.js';
export type { BridgeAuthRoutesProps } from './components/auth/BridgeAuthRoutes.js';
export { SignInForm } from './components/auth/SignInForm.js';
export type { SignInFormProps } from './components/auth/SignInForm.js';
export { SignUpForm } from './components/auth/SignUpForm.js';
export type { SignUpFormProps } from './components/auth/SignUpForm.js';
export { VerifyEmail } from './components/auth/VerifyEmail.js';
export type { VerifyEmailProps } from './components/auth/VerifyEmail.js';
export { MagicLinkLanding } from './components/auth/MagicLinkLanding.js';
export type { MagicLinkLandingProps } from './components/auth/MagicLinkLanding.js';
export { PasskeySetupLanding } from './components/auth/PasskeySetupLanding.js';
export type { PasskeySetupLandingProps } from './components/auth/PasskeySetupLanding.js';
export { PasskeyManager } from './components/auth/PasskeyManager.js';
export type { PasskeyManagerProps } from './components/auth/PasskeyManager.js';
export { ForgotPassword } from './components/auth/ForgotPassword.js';
export type { ForgotPasswordProps } from './components/auth/ForgotPassword.js';
export { SetPassword } from './components/auth/SetPassword.js';
export type { SetPasswordProps } from './components/auth/SetPassword.js';
export { InviteLanding } from './components/auth/InviteLanding.js';
export type { InviteLandingProps } from './components/auth/InviteLanding.js';
export { WorkspaceChooser } from './components/auth/WorkspaceChooser.js';
export type { WorkspaceChooserProps, WorkspaceRow } from './components/auth/WorkspaceChooser.js';
export { HandoffSignIn } from './components/auth/HandoffSignIn.js';
export type { HandoffSignInProps } from './components/auth/HandoffSignIn.js';
export { HostedSignIn } from './components/auth/HostedSignIn.js';
export type { HostedSignInProps } from './components/auth/HostedSignIn.js';
export { HostedCallback } from './components/auth/HostedCallback.js';
export type { HostedCallbackProps } from './components/auth/HostedCallback.js';
export { SignOutButton } from './components/auth/SignOutButton.js';
export type { SignOutButtonProps } from './components/auth/SignOutButton.js';
export { ProfileName } from './components/auth/ProfileName.js';
export { FeatureFlag } from './components/flags/FeatureFlag.js';
export type { FeatureFlagOffInfo, FeatureFlagProps } from './components/flags/FeatureFlag.js';
export { UpgradeDialog } from './components/billing/UpgradeDialog.js';
export { LiveStatusBadge } from './components/live/LiveStatusBadge.js';
export { TeamPanel } from './components/team/TeamPanel.js';
export type { TeamPanelProps, TeamTab, TeamTabId } from './components/team/TeamPanel.js';
export { MemberList } from './components/team/MemberList.js';
export type { MemberListProps } from './components/team/MemberList.js';
export { InviteList } from './components/team/InviteList.js';
export type { InviteListProps } from './components/team/InviteList.js';
export { InviteDialog } from './components/team/InviteDialog.js';
export type { InviteDialogProps } from './components/team/InviteDialog.js';
export { EditMemberDialog } from './components/team/EditMemberDialog.js';
export type { EditMemberDialogProps } from './components/team/EditMemberDialog.js';
export { ConfirmDialog } from './components/team/ConfirmDialog.js';
export type { ConfirmDialogProps, DialogActions } from './components/team/ConfirmDialog.js';
export { WorkspaceForm } from './components/team/WorkspaceForm.js';
export type { WorkspaceFormProps } from './components/team/WorkspaceForm.js';
export { ProfileForm } from './components/team/ProfileForm.js';
export type { ProfileFormProps } from './components/team/ProfileForm.js';
export { BridgeBillingRoutes } from './components/billing/BridgeBillingRoutes.js';
export type { BridgeBillingRoutesProps } from './components/billing/BridgeBillingRoutes.js';
export { PlanPicker } from './components/billing/PlanPicker.js';
export type { PlanCardContext, PlanPickerProps } from './components/billing/PlanPicker.js';
export { BillingPortalButton } from './components/billing/BillingPortalButton.js';
export type { BillingPortalButtonProps } from './components/billing/BillingPortalButton.js';
export { SubscriptionStatus } from './components/billing/SubscriptionStatus.js';
export type { SubscriptionStatusProps } from './components/billing/SubscriptionStatus.js';
export { BillingNotice } from './components/billing/BillingNotice.js';
export type { BillingNoticeProps } from './components/billing/BillingNotice.js';
export { QuotaBanner } from './components/billing/QuotaBanner.js';
export type { QuotaBannerProps } from './components/billing/QuotaBanner.js';
export { CheckoutNotice } from './components/billing/CheckoutNotice.js';
export type { CheckoutNoticeProps, CheckoutOutcome } from './components/billing/CheckoutNotice.js';
export { useQuota } from './components/billing/quota.js';
export type { Quota, QuotaState } from './components/billing/quota.js';

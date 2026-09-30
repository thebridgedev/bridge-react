import type { ComponentType } from 'react';
import type { MessageOverrides, ReturnToConfig } from '@nebulr-group/bridge-auth-core';
import type { BridgeQuotaRefusal } from '../core/quota-refusal';

/**
 * bridge configuration interface
 *
 * Every field resolves as *explicit option > environment > default* (TBP-743,
 * the same rule as every Bridge plugin). An empty variable counts as unset.
 *
 * | Field        | Vite                       | Create React App                |
 * |--------------|----------------------------|---------------------------------|
 * | `appId`      | `VITE_BRIDGE_APP_ID`       | `REACT_APP_BRIDGE_APP_ID`       |
 * | `apiBaseUrl` | `VITE_BRIDGE_API_BASE_URL` | `REACT_APP_BRIDGE_API_BASE_URL` |
 * | `hostedUrl`  | `VITE_BRIDGE_HOSTED_URL`   | `REACT_APP_BRIDGE_HOSTED_URL`   |
 * | `debug`      | `VITE_BRIDGE_DEBUG`        | `REACT_APP_BRIDGE_DEBUG`        |
 *
 * `callbackUrl`, `defaultRedirectRoute` and `loginRoute` are also read from
 * `…_BRIDGE_CALLBACK_URL`, `…_BRIDGE_DEFAULT_REDIRECT_ROUTE` and
 * `…_BRIDGE_LOGIN_ROUTE`.
 *
 * @example .env (Vite) — a production app needs only the first line
 * ```env
 * VITE_BRIDGE_APP_ID=your-app-id
 * VITE_BRIDGE_API_BASE_URL=https://api-stage.thebridge.dev
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
   * Bridge's API address. Only for a non-production app (stage, local,
   * self-hosted); unset means production (`https://api.thebridge.dev`).
   * @env VITE_BRIDGE_API_BASE_URL or REACT_APP_BRIDGE_API_BASE_URL
   */
  apiBaseUrl?: string;

  /**
   * Bridge's hosted pages (hosted sign-in, plan selection). On Bridge's own
   * domains it follows `apiBaseUrl` (`api-stage` → `auth-stage`); set it only
   * for a local or self-hosted Bridge.
   * @env VITE_BRIDGE_HOSTED_URL or REACT_APP_BRIDGE_HOSTED_URL
   */
  hostedUrl?: string;

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
   * UI language for the SDK auth components, e.g. 'sv' or 'sv-SE' (TBP-630).
   * Region variants resolve to their primary subtag; an unknown locale falls
   * back to English rather than throwing.
   * @default 'en'
   */
  locale?: string;

  /**
   * Per-key copy overrides applied on top of the resolved locale, for wording
   * an app genuinely needs to differ. Highest precedence in the chain, and
   * layered under each component's own `messages` prop.
   */
  messages?: MessageOverrides;

  /**
   * Deep-link preservation for `<ProtectedRoute>` (TBP-629).
   *
   * When the guard turns an unauthenticated visitor away, the page they asked
   * for is remembered and restored after login. On by default — set
   * `{ enabled: false }` to send every login to the same place.
   *
   * `loginRoute` is filled in from the top-level `loginRoute` above, so the
   * login page never becomes its own return target without you repeating
   * yourself.
   */
  returnTo?: ReturnToConfig;

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

  /**
   * Show the "Live updates off — why?" corner badge that `<BridgeProvider>`
   * mounts while realtime is refused, degraded or stuck retrying (TBP-644).
   * It only ever renders in development builds (`NODE_ENV !== 'production'`);
   * set `false` to hide it there too. Production builds never show it.
   * @default true
   */
  devBadge?: boolean;

  /**
   * Billing destinations. Every one has a default served by
   * `<BridgeBillingRoutes />` mounted at `/subscription/*` (TBP-743), so an
   * app that configures nothing redirects only to pages that exist. Set one to
   * move it — e.g. `paywallRoute: '/welcome'` for an onboarding page rendering
   * `<BridgePaywallPage />`.
   */
  billing?: {
    /**
     * Where a signed-in workspace with no plan is redirected. The default
     * applies only to an app that has plans (an app without billing has only
     * plan-less workspaces); a value set here always applies. `false` turns the
     * redirect off — for an app that gates with the `<BridgePaywall>` overlay
     * instead, or not at all. Workspaces of an app with `paymentsAutoRedirect`
     * off are never redirected.
     * @default '/subscription/plan'
     */
    paywallRoute?: string | false;
    /**
     * Where a failed Stripe checkout confirmation lands.
     * @default '/subscription/error'
     */
    paymentErrorRoute?: string;
    /**
     * The subscription page — the default destination of the Upgrade/Manage
     * CTA in `<BridgeQuotaBanner>`, `<BridgeBillingNotice>`, `<QuotaGate>` and
     * the upgrade dialog. A completed checkout lands on `<manageRoute>/success`.
     * @default '/subscription'
     */
    manageRoute?: string;
    /**
     * The dialog `<BridgeProvider>` opens when your backend refuses a request
     * because a plan limit is reached — a `402` whose JSON body has
     * `code: 'QUOTA_EXCEEDED'`, which bridge-nestjs's `@RequireQuota` sends —
     * or a feature is not on the plan (`402 FEATURE_NOT_IN_PLAN`, or a click on
     * a `<FeatureFlag>` upgrade prompt). `false` turns it off (listen with
     * `onBridgeQuotaExceeded()` instead); a component replaces it and receives
     * `BridgeUpgradeDialogProps`.
     * @default true
     */
    upgradeDialog?: boolean | ComponentType<BridgeUpgradeDialogProps>;
    /**
     * Origins of your own backend when it is not on the page's origin, e.g.
     * `['https://api.example.com']`. A `402 QUOTA_EXCEEDED` from the page's
     * origin, from Bridge's API, or from a call made with `bridgeFetch()` is
     * always recognised; one from any other origin only when it is listed here.
     */
    apiOrigins?: string[];
  };
}

/** Props the upgrade dialog receives — the default one, or yours via
 *  `billing.upgradeDialog: MyDialog`. */
export interface BridgeUpgradeDialogProps {
  /** The refusal to explain, or `null` while nothing has been refused. */
  refusal: BridgeQuotaRefusal | null;
  /** Where the upgrade button goes: the refusal's `fix` path, else `billing.manageRoute`. */
  upgradeHref: string;
  /** Whether this user may manage billing. `false`: a member — tell them to
   *  contact the workspace owner instead of linking to a page they cannot act on. */
  canUpgrade: boolean;
  /** Close the dialog. */
  onClose: () => void;
  /** The plan feature the user is missing, by key (or the feature flag's key
   *  when its rule names no plan feature). With no `refusal`, a non-null
   *  `feature` opens the dialog in its feature variant. */
  feature?: string | null;
  /** The app's plans, each with the features it includes. Used only to name
   *  the plans that include `feature`. */
  plans?: ReadonlyArray<PlanWithFeatures> | null;
}

/** A plan as the plan list returns it, with the features it includes.
 *  Structural so it holds whichever auth-core release is installed. */
export interface PlanWithFeatures {
  key: string;
  name: string;
  prices?: ReadonlyArray<{ amount: number }>;
  features?: ReadonlyArray<{ key: string; name: string }>;
}

# bridge-react ↔ bridge-svelte parity

The React column of the TBP-515 parity matrix. Rows are bridge-svelte 0.9.0's public surface (`origin/main`, `src/lib/index.ts` and `learning/mechanisms.md`). Cells:

- **present** — on bridge-react `main` before this change
- **added (TBP-743)** — added by the ten-line port, `feature/tbp-743-ten-line`
- **different** — deliberately not the same shape, with the reason

Last checked 2026-09-30 against bridge-svelte 0.9.0, bridge-react 0.8.0-beta.0 + TBP-743, auth-core 0.8.0.

## Bootstrap and config

| bridge-svelte | bridge-react | Notes |
|---|---|---|
| `bridgeBootstrap()` in `+layout.ts` (reads `VITE_BRIDGE_*`) | added (TBP-743) | `<BridgeProvider>` with no props reads `VITE_BRIDGE_*`, then `REACT_APP_BRIDGE_*` (CRA) |
| Precedence explicit option > environment > default | added (TBP-743) | Was environment > props before; breaking, see CHANGELOG |
| `hostedUrl` follows the API address (`api-stage` → `auth-stage`) | added (TBP-743) | `hostedUrlFor()` |
| Refuses to start without an app id, names `VITE_BRIDGE_APP_ID` | added (TBP-743) | different: logs the error and renders children without Bridge, instead of throwing — a React render error would take down public pages too |
| Dev warning: app id running against production | added (TBP-743) | |
| `<BridgeBootstrap>` shell (children wait for ready) | different | `<BridgeProvider>` initialises synchronously during the first render, so children never render before Bridge exists |
| `rules` / `defaultAccess` route rules, `assertAuthorized()` | different | SvelteKit guards in `load`; React guards with components: `<ProtectedRoute>` and flag-gated route components (`useFlag` / `<FeatureFlag>`). Router adapters carry the navigation |
| `billing.paywallRoute` (default `/subscription/plan`, `false` = off) | added (TBP-743) | Default applies only to an app with plans, as in svelte |
| `billing.paymentErrorRoute` (default `/subscription/error`) | added (TBP-743) | Was `/payment-error` |
| `billing.manageRoute` (default `/subscription`) | added (TBP-743) | Was `/billing` |
| `billing.upgradeDialog`, `billing.apiOrigins` | added (TBP-743) | |
| `locale`, `messages`, `returnTo`, `devBadge` | present | |

## Sign-in (auth components, route guard, callback)

| bridge-svelte | bridge-react | Notes |
|---|---|---|
| `<BridgeAuthRoutes>` at `auth/[...bridge]` | added (TBP-743) | Router-agnostic; `@nebulr-group/bridge-react/react-router` (`/auth/*`) and `/tanstack-router` (`auth/$`) adapters; no-router mode reads `window.location` |
| Rung 2: `frame` / `heading` snippets | added (TBP-743) | Render props `frame(page, children)` / `heading(page)` |
| Rung 3: take over a page with its own route file | different | Pass an element: `pages={{ login: <MyLogin /> }}`. A React route table has no file-precedence rule, and a more specific `<Route>` would also work but has to be kept in sync by hand |
| Unknown page → app's own 404 | different | Renders `notFound` (default: "Page not found.") under the mount point; React Router has already matched `/auth/*`, so the app's `*` route cannot see it |
| OAuth callback handled in `load` | present | `<CallbackHandler>`; `<BridgeAuthRoutes>` serves it at `oauth-callback` |
| `LoginForm`, `SignupForm`, `ForgotPassword`, `MagicLink`, `MfaChallenge`, `MfaSetup`, `SsoButton`, `TenantSelector`, `WorkspaceSelector` | present | |
| `headingSnippet` on every form (main step only) | added (TBP-743) | `headingSlot` on `SignupForm`, `ForgotPassword`, `MagicLink`, `PasskeySetup` (LoginForm had it) |
| Route guard / protected routes | present | `<ProtectedRoute>`; deep-link `returnTo` (TBP-629) |
| Magic link, MFA, workspace switching | present | |

## Passkeys

| bridge-svelte | bridge-react | Notes |
|---|---|---|
| `PasskeyLogin`, `PasskeySetup`, `PasskeyRequestSetupLink` | fixed (TBP-743) | Present but broken on `main`: they called auth-core methods that do not exist and never ran the WebAuthn ceremony. Now they do, as svelte does. `PasskeySetup` waits for a click before raising the browser prompt (svelte starts on mount); kept, because Safari requires a user gesture for WebAuthn |
| `setup-passkey/:token` page | added (TBP-743) | Served by `<BridgeAuthRoutes>` |
| `@simplewebauthn/browser` as a regular dependency (S3) | added (TBP-743) | Loaded on first use; `window.__simpleWebAuthn` wins when set (the e2e virtual-authenticator hook), as in svelte |

## Billing pages and plan picker

| bridge-svelte | bridge-react | Notes |
|---|---|---|
| `<BridgeBillingRoutes>` (`/subscription`, `/plan`, `/success`, `/error`) | added (TBP-743) | Same adapters and customisation as the sign-in pages |
| `<BridgePaywallPage>` | added (TBP-743) | |
| `<BillingPortalButton>` | added (TBP-743) | |
| `<PlanSelector>` interval tabs, cheapest first, features list, confirm step, retry on empty | added (TBP-743) | Ported with `plan-pick.ts` verbatim |
| S2 `planCard` / `planDescription` / `planFooter` snippets | added (TBP-743) | Render props; `planCard` existed, now also gets `interval` |
| `<BridgePaywall>` overlay, `<BridgeSubscriptionStatus>`, `<BridgeBillingNotice>`, `<BridgeQuotaBanner>` | present | |
| `subscriptionStore` / `loadSubscription` | present | `useBridgeStore((s) => s.subscription)`, `useSubscription()`, `loadSubscription()` |

## Plan limits and entitlements (levels 0/1/2)

| bridge-svelte | bridge-react | Notes |
|---|---|---|
| Level 0: upgrade dialog on `402 QUOTA_EXCEEDED` (global fetch + `bridgeFetch`) | added (TBP-743) | `<BridgeProvider>` installs a fetch observer (looks only; adds no headers) and mounts the dialog |
| Feature variant on `402 FEATURE_NOT_IN_PLAN` and upgrade clicks | added (TBP-743) | |
| Upgrade dialog on a plan-gated route redirect | different | Svelte opens it from its `load` route rules; React has no route rules — the level-1 `<FeatureFlag upgrade>` click covers the in-page case |
| `<BridgeUpgradeDialog>`, `onBridgeQuotaExceeded`, `openFeatureUpgrade`, `parseQuotaRefusal` | added (TBP-743) | |
| Level 1: `<QuotaGate metric>` (`atLimit`) | added (TBP-743) | `atLimit` is a render prop |
| Level 1: `<FeatureFlag upgrade>`, fallback `openUpgrade` | added (TBP-743) | Prop is `flagKey` (React reserves `key`) |
| `<Entitled to>` | added (TBP-743) | `fallback` / `loading` are nodes |
| Level 2: `useQuota(metric)` | added (TBP-743) | React hook over the same auth-core `QuotaStore` |
| `$entitlements` store | added (TBP-743) | `useEntitlements()` |
| `bridgeFetch()` | added (TBP-743) | |
| `bridge.usage.report` / `set`, double-count dev warning | added (TBP-743) | |
| Direct-plan-check dev note | added (TBP-743) | |

## Theming

| bridge-svelte | bridge-react | Notes |
|---|---|---|
| `--bridge-*` token contract on `:where(:root)` | added (TBP-743) | Stylesheet is svelte's, plus the four components svelte styles in-component; a unit test fails on any literal colour outside a token |
| Deprecated aliases `--bridge-primary-foreground`, `--bridge-bg-muted` | added (TBP-743) | |

## Flags, live updates, team, developer

| bridge-svelte | bridge-react | Notes |
|---|---|---|
| `<FeatureFlag>`, flag registry shared across entries (TBP-665) | present | Intact: one registry chunk for the main and `/flags` entries (`test-dist/shared-registry.dist.tsx`) |
| Flag off-reasons (TBP-756) | present | |
| `bridge` unified surface, `useBridge()` | present | |
| Realtime status, dev badge, reconnect catch-up (TBP-700) | present | |
| Team management panel and dialogs, seat limit (TBP-763) | present | |
| `ApiTokenManagement` | present | |
| Reddit / GA conversion tracking | present | |

## Guides

| bridge-svelte | bridge-react | Notes |
|---|---|---|
| `learning/mechanisms.md` | added (TBP-743) | React code, same rules |
| `learning/sdk-auth/sdk-quickstart.md` | present, updated (TBP-743) | Re-advertising it in `bridge guide` is a bridge-cli change (`guide.command.ts`), not in this repo |
| `learning/theming/theming.md` | updated (TBP-743) | |

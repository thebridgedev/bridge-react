# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

The ten-line integration (TBP-743), and the React slice of svelte parity (TBP-515).

### Breaking

- **Config precedence is now explicit option > environment > default.** `<BridgeProvider>` used to let `VITE_BRIDGE_*` / `REACT_APP_BRIDGE_*` override the `appId` and `config` props. An option you pass in code now wins; the environment only fills what you did not pass. If you relied on `.env` overriding a hard-coded prop, remove the prop.
- **Billing defaults point at pages Bridge serves.** `billing.manageRoute` defaults to `/subscription` (was `/billing`), `billing.paymentErrorRoute` to `/subscription/error` (was `/payment-error`), and `<CallbackHandler>`'s `paymentErrorRoute` follows it. Mount `<BridgeBillingRoutes>` at `/subscription/*`, or set the old addresses in `billing`.
- **A paywall redirect is on by default for apps with plans.** A signed-in workspace with no plan is sent to `/subscription/plan` (served by `<BridgeBillingRoutes>`) when the app has plans and `paymentsAutoRedirect` is on. `billing.paywallRoute: false` turns it off; an explicit `paywallRoute` behaves as before. An app with no plans is never redirected.
- **`<PlanSelector>`:** a free pick (or a plan Bridge sets directly) now goes on to `successRedirect`, as a paid checkout does, unless you pass `onSelect`; switching an existing subscriber's plan asks for confirmation first; plans are sorted cheapest first. (Same behaviour as bridge-svelte.)
- **Styles:** the token defaults moved from `:root` to `:where(:root)`, so your own `:root` always wins. The billing notice, quota banner, subscription badge and paywall no longer paint hard-coded colours; they follow the `--bridge-*` tokens.

### Added

- `<BridgeProvider>` with no props starts from `VITE_BRIDGE_APP_ID` (or `REACT_APP_BRIDGE_APP_ID`); new `apiBaseUrl` / `hostedUrl` config fields, the hosted pages follow a Bridge API address (`api-stage` → `auth-stage`), a development warning when an app id runs against production, and a clear error naming `VITE_BRIDGE_APP_ID` when none is set. `resolveBridgeConfig()` / `readBridgeEnv()` are exported.
- `<BridgeAuthRoutes>` — every sign-in page (login, signup, the OAuth callback, set-password, forgot-password, magic-link, setup-passkey, workspaces) from one route. Router-agnostic; adapters at `@nebulr-group/bridge-react/react-router` (`<Route path="/auth/*" element={<BridgeAuthRoutes />} />`) and `@nebulr-group/bridge-react/tanstack-router` (`path: 'auth/$'`). Customise with `frame(page, children)` / `heading(page)`, or take over one page by passing an element: `pages={{ login: <MyLogin /> }}` (a function receives the email-link token).
- `<BridgeBillingRoutes>` — the subscription page, `/plan` (paywall), `/success` and `/error` from one route, with the same adapters and customisation; `<BridgePaywallPage>` for an onboarding paywall at your own address; `<BillingPortalButton>`.
- Plan limits in the UI, levels 0/1/2: `<BridgeProvider>` mounts an upgrade dialog that opens when your backend answers `402 QUOTA_EXCEEDED` (plain `fetch` to your own origin, or `bridgeFetch()` anywhere) or `402 FEATURE_NOT_IN_PLAN` (`billing.upgradeDialog: false | MyDialog`, `billing.apiOrigins`, `onBridgeQuotaExceeded()`); `<QuotaGate metric>`, `<Entitled to>` and `<FeatureFlag upgrade>` (its fallback also gets `openUpgrade`); `useQuota(metric)` and `useEntitlements()`; `bridgeFetch()`; `bridge.usage.report()` / `bridge.usage.set()` with a development warning when a metric is counted on both sides.
- `<PlanSelector>`: billing-interval tabs (`defaultInterval`), each plan's features, and the `planDescription` / `planFooter` render props beside `planCard` (which now also gets `interval`).
- `headingSlot` on `SignupForm`, `ForgotPassword`, `MagicLink` and `PasskeySetup` (main step only), as `LoginForm` already had.
- The full `--bridge-*` token contract of bridge-svelte (see `learning/theming/theming.md`).
- `docs/parity-with-svelte.md` — the React column of the parity matrix.

### Fixed

- **Passkeys work.** `<PasskeyLogin>`, `<PasskeySetup>` and `<PasskeyRequestSetupLink>` called auth-core methods that do not exist (`registerPasskeyWithToken`, `sendPasskeySetupLink`) or skipped the authenticator (`authenticateWithPasskey()` with no answer), so an emailed setup link always failed and passkey sign-in never reached an authenticator. They now run the WebAuthn ceremony (`@simplewebauthn/browser`, now a dependency, loaded on first use) against auth-core's `getPasskeyAuthOptions` / `authenticateWithPasskey`, `getPasskeyRegistrationOptions` / `verifyPasskeyRegistration` and `requestPasskeySetupLink`. `<PasskeyLogin>` is hidden in a browser without passkeys (as in bridge-svelte); `<PasskeySetup>` names an expired link and takes `onExpired`.

### Changed

- `react-router` (>=6.4 <8) and `@tanstack/react-router` (^1) are optional peer dependencies, used only by their adapter entries.

## [0.2.1] - 2025-02-17

### Added

- Install test: `bun run test:install` and CI workflow to verify the packed package installs with React 18 and React 19.

### Changed

- Peer dependencies `react` and `react-dom` updated to include `^19.0.0` for React 19 compatibility.

### Fixed

- Install test script now cleans up `install-test-tmp` and `install-test-pkg.tgz` after run (and on exit).

## [0.2.0] - 2025-02-15

### Changed

- Documentation: README default callback URL corrected to `origin + '/auth/oauth-callback'`.
- Quickstart and examples: consistent "Bridge" product naming.
- Plan service and related hooks for subscription/plan management.

## [0.1.0] - Previous

Initial release.

[0.2.1]: https://github.com/thebridgedev/bridge-react/releases/tag/v0.2.1
[0.2.0]: https://github.com/thebridgedev/bridge-react/releases/tag/v0.2.0
[0.1.0]: https://github.com/thebridgedev/bridge-react/releases/tag/v0.1.0

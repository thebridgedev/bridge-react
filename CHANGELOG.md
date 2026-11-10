# Changelog

## [0.8.2] - 2026-11-09

### Fixed

- **Paid features stay unlocked after a reload.** A workspace on a plan that includes a feature now sees it unlocked from the first paint: on a reload, after signing in again and after switching workspace. Before, a feature gated on the plan (`<FeatureFlag>` with a `bridge:billing.entitlement.*` rule) showed "Upgrade to use this" on most page loads, because the SDK never read the plan's features (`GET /entitlements`); it only looked right straight after a checkout. A page that loads signed in now reads the plan's features, the billing state and the flag definitions before it renders (each capped at 1.5 s, like the Svelte SDK), and reads them again when the session changes. (TBP-941)
- **A plan limit closes as soon as it is reached.** After `bridge.usage.report()` uses up a hard limit, `<QuotaGate>` and `useQuota()` show it within a couple of seconds, without a reload. Before, the SDK queued one `bridge.flag_evaluations` count per flag on every render, ahead of the app's own report, so a busy page could hold that report back for many seconds and a Free workspace could go past its limit. The SDK now adds those counts up and sends them about once a second, with the same total. Quota reads also use the current sign-in after a sign-in or workspace switch. (TBP-942)

## [0.8.1] - 2026-11-04

### Fixed

- **A finished-looking sign-in page.** The show-password toggle on the sign-in and set-password pages is an eye icon instead of an emoji. "Sign in with Passkeys" and "Sign in with Magic Link" carry icons like the other sign-in buttons, and "Sign in with Magic Link" is a button, centred and no longer underlined. The sign-in pages now look the same as in the other Bridge packages.
- **Sign-in links match your app.** "Sign up", "Log in" and the other text links on the sign-in pages take the form's text colour and font, instead of the browser's default blue.

## [0.8.0] - 2026-09-30

### Added

- **Sign-in pages through your own router.** One component now serves every sign-in page through the router your app already uses, instead of each page being wired by hand. Plan limits and the upgrade prompt behave the same as in the Svelte package.
- **Why a feature is off.** When a feature flag keeps something hidden, the fallback now knows the reason: not on the plan opens the upgrade dialog, not allowed for this person tells them to ask an admin, and switched off simply hides it.
- **Seat limits on the built-in team page.** Give your plan a seat limit and the team page stops invites once the workspace reaches it. Previously a 2-seat plan could still invite a third member.

### Changed

- **Breaking: one route per sign-in page family.** Sign-in pages are now registered through the new component rather than as separate routes; replace your individually wired sign-in routes with it when upgrading.
- **Requires auth-core 0.8.0.** Upgrade `@nebulr-group/bridge-auth-core` to 0.8.0 alongside this package.

### Fixed

- **Subscription status after checkout.** Subscription and quota components now renew an out-of-date sign-in on their own. Previously the page after Stripe checkout could show "Subscription unavailable" until it was reloaded.
- **User changes during a reconnect.** A change to the signed-in user's state that happens while the live connection is reconnecting is no longer missed.

## [0.7.5] - 2026-09-26

### Fixed

- **Returning from Stripe checkout.** Customers who complete checkout behind a paywall now land back in your app with their payment confirmed. Previously they were sent to the plan picker again and treated as unpaid until their session refreshed.

## [0.7.4] - 2026-09-26

### Fixed

- **Session snapshot on first connection.** After sign-in, the workspace name and id, the branding and the entitlements now appear immediately. Previously they stayed empty, so every entitlement check answered no and a paywall built on one would lock everyone out.
- **Live updates and browser usage reporting.** Live updates now connect, so plans, entitlements and usage counters refresh without a page reload, and usage reported from the browser is recorded. Previously the browser rejected these calls, so live updates never connected and browser-side usage reports were lost.
- **Documentation links.** Three pages in the guides linked to addresses with no page behind them; they now resolve.

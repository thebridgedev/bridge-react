# Changelog

## [0.9.0] - 2026-11-10

### Changed

- **After checkout, people land back in the app.** A completed checkout or a Free plan pick now returns to the subscription page with a "You're on Pro now" banner, with no separate confirmation step. Set `billing.successRoute` to land on any page of your app, and put `<BridgeCheckoutNotice />` there for the same banner, or read `useCheckoutResult()` for a message of your own. The old confirmation page at `/subscription/success` still works for apps that point to it. (TBP-945)
- **A subscription page that fits your app.** Plan cards and the current-plan panel have their own surface built from your `--bridge-*` tokens, so they look right on any app background. Prices are shown large and formatted for their currency, buttons say "Upgrade to" or "Switch to", the current plan is marked in your primary colour, and its renewal date and card are shown. Two optional tokens, `--bridge-card-bg` and `--bridge-card-shadow`, tune the cards. Plan buttons no longer read "Select free plan" or "29 USD / month", so tests that match that text need updating. (TBP-945)
- **Bridge pages follow your app's text.** Every text size on the sign-in and subscription pages now scales from your page's body text size, alongside the font family and text colour they already inherited. At the usual 16px nothing changes; set `--bridge-font-size` to size Bridge text differently. (TBP-945)
- **Your CSS always wins.** Bridge's styles now live in a CSS cascade layer named `bridge`, so any normal CSS you write against a Bridge class or data attribute overrides it, whatever the load order or specificity, with no `!important`. CSS inside one of your own layers declared before `bridge`, including Tailwind utility classes on Bridge's elements, still ranks below it. (TBP-945)

### Added

- **Weight and shadow settings.** `--bridge-font-weight-heading`, `--bridge-font-weight-button`, `--bridge-font-weight-label` and `--bridge-button-shadow` let an app with heavy type or hard drop shadows carry that look onto the Bridge pages. `--bridge-card-shadow` also styles the plan-change dialog. Every default is the previous look. (TBP-945)

These bring the React package level with the Svelte package's 0.9.2 and 0.9.3.

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

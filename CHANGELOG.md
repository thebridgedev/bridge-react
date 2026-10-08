# Changelog

All notable changes to this package are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the package uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

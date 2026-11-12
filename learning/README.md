# Learning documentation

The guides for `@nebulr-group/bridge-react` 1.0, for the developer integrating it.

- **[Quickstart](quickstart/quickstart.md)**: install, the issuer, the provider and the two routes.
- **[Sign-in pages](sign-in/sign-in.md)**: sign-in, sign-up, email links, password recovery, invites, workspaces, sign-out, and the language.
- **[Flags and route guards](flags/flags.md)**: every gate as a flag, route rules, `<FeatureFlag>`, and the standard flags.
- **[Billing](billing/billing.md)**: plans, checkout, the billing portal, notices and plan limits.
- **[The team panel](team/team.md)**: members, invites, roles and workspace settings.
- **[Live updates](live-updates/live-updates.md)**: screens that refresh within a second of a change.
- **[Theming](theming/theming.md)**: tokens, your own CSS, and the four customisation rungs.
- **[Hand-off mode](handoff/handoff.md)**: a sign-in page for a command-line tool.

## Coming from the Svelte plugin

`@nebulr-group/bridge-react` 1.0 has the same components, props, settings and pages as `@nebulr-group/bridge-svelte` 1.0, so its guides map one to one. What differs is how React spells things:

| Svelte | React |
|---|---|
| `bridgeBootstrap(config)` in `+layout.ts` and `<BridgeBootstrap>` in `+layout.svelte` | `<BridgeProvider config={config} router={…}>` around your routes |
| `src/routes/auth/[...bridge]/+page.svelte` | `<Route path="/auth/*" element={<BridgeAuthRoutes />} />` |
| `PUBLIC_BRIDGE_ISSUER` | `issuer: import.meta.env.VITE_BRIDGE_ISSUER` in the config |
| Stores: `$session`, `$user`, `$workspace`, `$flags`, `$billing`… | Hooks: `useSession()`, `useUser()`, `useWorkspace()`, `useFlags()`, `useBilling()`… |
| `flag('x')`, `canManageBilling()` stores | `useFlag('x')`, `useCanManageBilling()` |
| A snippet: `headingSnippet`, `footer`, `titleSnippet` | A node: `heading`, `footer`, `title` |
| A snippet with arguments: `frame(page, form)`, `fallback(value, off)` | A render function of the same name |
| `<FeatureFlag key="x">` | `<FeatureFlag flagKey="x">` (`key` is React's own prop) |
| Lower-case events: `onclose`, `oninvited` | `onClose`, `onInvited` |
| `class` | `className` |
| `<a href>` (SvelteKit routes it) | `<Link href>`, or your router's link |
| `requireFlag` in a load function | `requireFlag()` resolves `true` or `false`, and goes to `redirectTo` when off |
| `@nebulr-group/bridge-svelte/server` | No server side: your API checks tokens with `@nebulr-group/bridge-auth-core/server` |

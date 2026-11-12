# Flags and route guards

Every gate in your app is a flag: a page, a link, a button. The flag's rule, set in Bridge, says why it is on for someone: a privilege, a plan feature, a rollout. Your code reads the flag, never a role, a privilege list or the plan. Change who sees what in Bridge, without a deploy.

A flag Bridge has no result for is off (or gives the fallback you pass), so gates fail closed.

## Guarding routes

```ts
const config: BridgeConfig = {
  issuer: import.meta.env.VITE_BRIDGE_ISSUER,
  rules: [
    { match: '/', public: true },
    { match: '/docs/*', public: true },
    { match: '/reports', featureFlag: 'reports', redirectTo: '/' },
    { match: /^\/admin(\/|$)/, featureFlag: { all: ['admin-area', 'reports'] } },
  ],
};
```

- The first rule whose `match` fits the path decides. `match` is an exact path, a path with `*`, or a RegExp.
- `public: true` opens a route to visitors. Routes no rule matches need a signed-in person, unless `defaultAccess: 'public'`.
- `featureFlag` names one flag, `{ any: [...] }` or `{ all: [...] }`. While it is off, the person goes to `redirectTo` (default: your home page after sign-in).
- The guard runs again when the session or the flags change, so a flag turned off in Bridge closes an open page within a second.
- While the first navigation waits for Bridge, `<BridgeProvider>` shows its `loading` prop. A page whose flag is off and whose `redirectTo` is the page itself shows its `forbidden` prop.

Outside the route rules, in your own code, `requireFlag` waits for the flag results and resolves `true` when the flag is on. When it is off, it resolves `false` and, with `redirectTo`, sends the browser there:

```ts
import { requireFlag } from '@nebulr-group/bridge-react';

if (!(await requireFlag('reports', { redirectTo: '/' }))) return;
```

## Showing and hiding

```tsx
import { FeatureFlag, Link } from '@nebulr-group/bridge-react';

<FeatureFlag flagKey="reports">
  <Link href="/reports">Reports</Link>
</FeatureFlag>
```

The flag's key is `flagKey`: `key` is React's own prop.

When a feature is off because the workspace's plan lacks it, `<FeatureFlag upgrade>` shows a small upgrade prompt in its place, which opens the upgrade dialog. For your own wording, use `fallback`:

```tsx
<FeatureFlag
  flagKey="reports"
  fallback={(_value, { reason, openUpgrade }) =>
    reason === 'plan' ? <button onClick={openUpgrade}>Upgrade for reports</button> : null
  }
>
  <Reports />
</FeatureFlag>
```

`children` may also be a function of the flag's value, for a flag that is not a boolean: `{(theme) => <Theme name={theme} />}` with `defaultValue`.

## In your code

```tsx
import { useFlag } from '@nebulr-group/bridge-react';

const reports = useFlag('reports');          // reports.value, reports.reason
const theme = useFlag('theme', 'light');     // theme.value: 'light' until Bridge says otherwise
```

`useFlags()` gives every result, and `useFlagsStatus()` says whether they have loaded. Outside a component, `getBridge().flags.enabled('reports')`.

## The standard flags

Bridge keeps three flags for every app, and the plugin's own screens gate on them. Their rules are yours to change in Bridge.

| Flag | On means | Used by |
|---|---|---|
| `bridge-billing-manage` | may choose a plan and open the billing portal | the plan picker, the portal button, the upgrade dialog |
| `bridge-team-manage` | may invite, change roles and remove members | the team panel |
| `bridge-app-active` | the app is active for this workspace | the paywall: while it is off, signed-in people go to the plan page |

To gate them on your own flags instead:

```ts
const config: BridgeConfig = { issuer, flags: { billingManage: 'can-pay', teamManage: 'can-admin', appActive: 'subscribed' } };
```

`useCanManageBilling()` and `useCanManageTeam()` give the first two as hooks, for your own screens (`canManageBilling()` and `canManageTeam()` outside a component).

## Hints

A rule may read values your page knows, such as a country. Pass them as hints:

```ts
const config: BridgeConfig = { issuer, hints: { country: 'SE' } };
```

Who the person is always comes from their token, never from a hint.

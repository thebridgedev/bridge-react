# Feature Flags

Conditional rendering and access control driven by Bridge Feature Flags 2.0.

Bridge evaluates flags **locally in the SDK** against a cache of flag rules that
syncs live from the Bridge API. The cache rides the same realtime channel as the
rest of Bridge (auth, billing) — toggling a flag in the admin UI updates your app
without a refresh.

## Define flags

Create flag definitions in the Bridge admin UI. Each flag has:
- A unique key (e.g. `beta-dashboard`).
- A state: `off`, `on`, or `on-with-rule`.
- For `on-with-rule`: a targeting rule (branches of conditions against
  attributes like `user.role`, `tenant.plan`, or dev-supplied attributes).

## Setup

Feature Flags 2.0 is bootstrapped automatically by `<BridgeProvider>` — no extra
wiring. Mount the provider once at your app root (see the Configuration guide):

```tsx
// src/main.tsx
import { BridgeProvider } from '@nebulr-group/bridge-react';

createRoot(document.getElementById('root')!).render(
  <BridgeProvider appId="your-app-id">
    <App />
  </BridgeProvider>
);
```

## `<FeatureFlag>` component

```tsx
import { FeatureFlag } from '@nebulr-group/bridge-react';

// React reserves the prop name `key`, so the flag key is passed as `flagKey`.
<FeatureFlag flagKey="beta-dashboard" defaultValue={false} fallback={<p>Stable dashboard</p>}>
  <p>Beta dashboard preview</p>
</FeatureFlag>
```

`children` renders when the rule passes; `fallback` renders when the flag is off
or no rule matched. `defaultValue` is required — it's the value used until the
cache hydrates and whenever no rule matches. `children` can also be a render-prop
that receives the Bridge-decided value (useful for non-boolean flags):

```tsx
<FeatureFlag flagKey="ui-theme" defaultValue="light">
  {(value) => <App theme={value} />}
</FeatureFlag>
```

Pass `context` to evaluate against attributes your app supplies at call time —
these override server-side values for the same key:

```tsx
<FeatureFlag flagKey="plan-flag" defaultValue={false} context={{ attributes: { plan } }}>
  {() => <EnterpriseFeature />}
</FeatureFlag>
```

## `useFlag` hook

```tsx
import { useFlag } from '@nebulr-group/bridge-react';

export function CTA() {
  const { value, passed } = useFlag('new-checkout', false);
  return passed ? <NewCheckout /> : <LegacyCheckout />;
}
```

`useFlag(key, defaultValue, context?)` returns `{ value, passed }` and re-renders
whenever the flag changes in the cache (live update, hydrate, login/logout). Pass
`context` for per-call attributes, same as the component:

```tsx
const { value } = useFlag('enterprise-feature', false, { attributes: { plan } });
```

## Dev-supplied attributes

Your app can declare attributes globally via the unified bridge surface so every
flag eval sees them, without threading `context` through each call:

```tsx
import { bridge } from '@nebulr-group/bridge-react';

bridge.attributes.set('plan', 'enterprise');
bridge.attributes.bindMany(() => ({ plan: currentPlan, region: currentRegion }));
```

For one-off per-call evaluation against attributes the app supplies at call time,
reach for the raw instance via `getBridgeFlagsInstance()`, whose `.flag()` takes a
per-call attributes argument:

```tsx
import { getBridgeFlagsInstance } from '@nebulr-group/bridge-react';

const instance = getBridgeFlagsInstance();
const { value } = instance.flag<boolean>('enterprise-feature', false, {
  attributes: { plan: 'enterprise' },
});
```

Dev-supplied attributes win on key collision with Bridge-managed providers
(auth, billing). Per-call `context` / `attributes` win over everything for that
one eval.

## Auth-free flags subpath

Need flags without pulling in the full auth runtime (e.g. a marketing page, or a
standalone widget)? Import from the `@nebulr-group/bridge-react/flags` subpath
entry, which exposes the flag APIs (`createBridgeFlags`, `getBridgeFlagsInstance`,
`useFlag`, `FeatureFlag`, `CachedFlag`, …) without the auth surface:

```tsx
import { useFlag } from '@nebulr-group/bridge-react/flags';
```

## Advanced: `createBridgeFlags`

`<BridgeProvider>` calls `createBridgeFlags()` for you. Call it directly only for
standalone-SDK use or tests where you need a second instance:

```tsx
import { createBridgeFlags } from '@nebulr-group/bridge-react';

const { bridge, stop } = createBridgeFlags({ registerGlobal: false });
```

## Environment variables

| Variable | Purpose |
|---|---|
| `VITE_BRIDGE_APP_ID` | Your Bridge app id — the workspace flags evaluate against. |
| `VITE_BRIDGE_AUTH_BASE_URL` | Bridge API root (defaults to `https://api.thebridge.dev`). |

(`REACT_APP_BRIDGE_*` is also recognized for CRA / webpack toolchains.) The flag
SDK reads `appId` + `authBaseUrl` from the BridgeAuth config — no separate flag
configuration is needed.

## Caching & freshness

The flag cache hydrates on bootstrap and re-hydrates on every realtime reconnect;
live updates push individual flag changes. No TTL — it's a live channel.

## Common pitfalls

- **Use `flagKey`, not `key`.** React reserves `key`; the component will never
  receive a prop named `key`.
- **`defaultValue` is required.** It's the value rendered until the cache
  hydrates and whenever no rule matches — always pass something sensible.
- **Flags before authentication:** anonymous users still get evaluated (the SDK
  tracks an anonymous identity). Rule-targeted flags that need a logged-in user
  fall through to the default.
- **Flag keys must match exactly** what's in the Bridge admin UI. Typos silently
  return the default.

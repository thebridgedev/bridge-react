# Bridge React — Feature Flags

You are adding **Feature Flags 2.0** to a React (Vite / CRA) application that uses
The Bridge. The goal is to ship code behind a switch you control from the Bridge
dashboard — no redeploy needed.

Bridge evaluates flags **locally in the SDK** against a cache of flag rules that
syncs live from the Bridge API. The cache rides the same realtime channel as auth
+ billing — toggling a flag in the dashboard updates the app **without a refresh**.
Flags are auth-free: they evaluate for every visitor, logged in or not.

## 1. Install

Use whatever package manager the project's lockfile says (npm shown):

```bash
npm install @nebulr-group/bridge-react
# or: yarn add @nebulr-group/bridge-react
# or: pnpm add @nebulr-group/bridge-react
```

The flag surface is exported from both the main entry `@nebulr-group/bridge-react`
and the `@nebulr-group/bridge-react/flags` subpath. The subpath is the flags-only
barrel — use it if you want to avoid pulling auth UI into the bundle. The snippets
below import from the main entry to match the demo app.

## 2. Init — wrap your app in `<BridgeProvider>`

`<BridgeProvider>` mounts the Bridge core runtime (realtime channel + the flag eval
cache) on first render. There is no separate flags provider — importing/rendering
the provider is all the wiring flags need.

```tsx
// src/main.tsx
import { BridgeProvider } from '@nebulr-group/bridge-react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <BridgeProvider>
    <App />
  </BridgeProvider>,
);
```

`<BridgeProvider>` reads its `appId` from `VITE_BRIDGE_APP_ID` (Vite) or
`REACT_APP_BRIDGE_APP_ID` (CRA) by default. You can also pass it explicitly:

```tsx
<BridgeProvider appId="your-app-id">
  <App />
</BridgeProvider>
```

Flags start evaluating for all visitors as soon as `<BridgeProvider>` mounts —
login is not required.

## 3. First flag call

### Declarative — `<FeatureFlag>`

> **Note:** React reserves the prop name `key`, so the flag key is passed as
> `flagKey`. `children` renders when the flag is on; `fallback` when it is off.

Create `src/components/FlagsDemo.tsx`. The flag is auto-created in Bridge as off
the first time the component renders.

```tsx
// src/components/FlagsDemo.tsx
import { FeatureFlag } from '@nebulr-group/bridge-react';

export function FlagsDemo() {
  return (
    <div style={{ maxWidth: 480, margin: '4rem auto', textAlign: 'center' }}>
      <h1>Feature Flag Demo</h1>
      <p>
        Toggle <strong>demo-flag</strong> in the Bridge dashboard and watch this
        box change — no refresh needed.
      </p>

      <FeatureFlag
        flagKey="demo-flag"
        defaultValue={false}
        fallback={
          <div style={{ padding: '2.5rem', background: '#f0f0f0', color: '#555', borderRadius: 10 }}>
            This box turns green once you enable <strong>demo-flag</strong>.
          </div>
        }
      >
        <div style={{ padding: '2.5rem', background: '#d4edda', color: '#155724', borderRadius: 10 }}>
          <strong>demo-flag</strong> is <strong>enabled</strong>.
        </div>
      </FeatureFlag>
    </div>
  );
}
```

### Imperative — the `useFlag` hook

For branching in code, use the hook. It returns `{ value, passed }` and re-renders
on every change to that flag:

```tsx
import { useFlag } from '@nebulr-group/bridge-react';

export function ConditionalButton() {
  const { passed } = useFlag('new-checkout', false);
  if (!passed) return null;
  return <button>Try the new checkout</button>;
}
```

Non-boolean flags are typed from the default:

```tsx
const { value: maxUploads } = useFlag('max_uploads', 10);             // number
const { value: mode }       = useFlag('pipeline_mode', 'stable');     // string
const { value: limits }     = useFlag('rate_limit', { window: 60 });  // json
```

**After creating the file, tell the user:**

> I've added a feature flag demo. Render `<FlagsDemo />` somewhere in your app,
> open it in the browser, then go to **Feature Control** in the Bridge dashboard
> and toggle **demo-flag** on — the box turns green without a page refresh.

## 4. Where to put eval context

Flags don't require auth. But if you have your own user model, pass an eval context
so rules can target it. Both the component and the hook accept a `context` for
per-call attributes:

```tsx
const { passed } = useFlag('enterprise-feature', false, {
  identity: user.id,                 // stable per-user id — required for % rollouts
  attributes: { plan: user.plan },   // anything your rules target on
});

<FeatureFlag flagKey="enterprise-feature" defaultValue={false} context={{ attributes: { plan } }}>
  {() => <Enterprise />}
</FeatureFlag>
```

Per-call attributes win on key collision over Bridge-managed providers. For app-wide
attributes you'd otherwise thread through every call, set them once on the singleton:
`bridge.attributes.set(...)` / `bridge.attributes.bindMany(...)`.

> **Percentage rollouts need `identity`.** If a rule rolls out to a percentage and no
> identity is on the context, the SDK refuses to bucket and returns the safe default —
> it never randomizes per call.

## 5. What to expect in the dashboard

The first time any flag key is evaluated, Bridge **auto-creates it as off** and it
appears at **app.thebridge.dev/flags** (Feature Control). From there you flip it on,
set an `on-with-rule` rule (target by attribute, percentage rollout), or change its
value live. Connected clients pick up the change over the realtime channel within
seconds — no redeploy, no refresh.

## 6. Standalone vs full-platform

- **Standalone flags:** pass your own `{ identity, attributes }` as shown above.
- **With Bridge Auth:** if the app also uses Bridge Auth (same `<BridgeProvider>`),
  the signed-in user's `role` and `plan` merge into the eval context automatically
  via the auth attribute provider — your rules can target `user.role` / `tenant.plan`
  with no extra wiring.

## 7. Troubleshooting

Flag not showing in the dashboard within ~30s, or `useFlag` returns the default
forever:

- **API key / appId.** Confirm `VITE_BRIDGE_APP_ID` (or `REACT_APP_BRIDGE_APP_ID`) is
  set, or that you passed `appId` to `<BridgeProvider>`. A flag is only registered
  once it's been evaluated for a real workspace.
- **Provider above the component.** `useFlag` / `<FeatureFlag>` must render under
  `<BridgeProvider>`. If they're outside the tree, every read returns the default.
- **SDK initialized before first read.** `<BridgeProvider>` inits synchronously on
  first render, so any child is fine. Reading a flag at module scope (before any
  render) returns the default until the cache hydrates.
- **Realtime / live channel.** Live toggles ride the realtime channel; if a corporate
  proxy blocks WebSockets the value still resolves on next load, just not instantly.
- **First-render flicker is expected** — flags hydrate async. Set `defaultValue` to a
  safe-off state, or render a skeleton until `passed` settles.

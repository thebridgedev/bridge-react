# Bridge React — Feature Flags

You are adding **Feature Flags** to a React application (Vite or CRA) that uses The Bridge. The goal is to ship code behind a switch you control from the Bridge dashboard — no redeploy needed.

## Prerequisites check

Before starting, verify that Bridge is set up in this project:

1. `@nebulr-group/bridge-react` is in `package.json` dependencies
2. `src/main.tsx` (Vite) or `src/index.tsx` (CRA) wraps the app in `<BridgeProvider>`
3. `VITE_BRIDGE_APP_ID` is set in `.env` — CRA projects use `REACT_APP_BRIDGE_APP_ID`

If any are missing, run `bridge guide react` first.

## Step 1 — Activate the flags layer

There is no separate flags package and no second provider. `<BridgeProvider>` mounts the whole Bridge core runtime — realtime channel, then the flag layer on top of it (local eval cache, hydration from the workspace, live updates on the same socket). Mounting the provider *is* the flag wiring.

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

`<BridgeProvider>` reads its `appId` from `VITE_BRIDGE_APP_ID` / `REACT_APP_BRIDGE_APP_ID`; you can also pass it as a prop (`<BridgeProvider appId="…">`) — the env var wins if both are present. Init runs **synchronously during the provider's first render**, not in an effect, so any descendant may read a flag immediately.

Flags start evaluating for all visitors as soon as `<BridgeProvider>` mounts — login is not required.

The flag surface is exported from both the main entry and the `@nebulr-group/bridge-react/flags` subpath. They are the same API; use `/flags` if you want the flag-only barrel without the auth UI on the graph.

## Step 2 — Create the demo component

Create `src/components/FlagsDemo.tsx` with the content below. It uses `FeatureFlag` to gate a visible box: grey with a striped border when the flag is off, solid green when it is on. The flag is auto-created in Bridge as off the first time the component renders.

```tsx
// src/components/FlagsDemo.tsx
import { FeatureFlag } from '@nebulr-group/bridge-react';

const box: React.CSSProperties = {
  margin: '2rem auto', padding: '2.5rem 2rem', borderRadius: 10, transition: 'background 0.4s ease',
};
const off: React.CSSProperties = {
  ...box, color: '#555', border: '8px solid transparent',
  background:
    'linear-gradient(#f0f0f0, #f0f0f0) padding-box,' +
    'repeating-linear-gradient(45deg, #aaa 0, #aaa 8px, transparent 8px, transparent 18px) border-box',
};
const on: React.CSSProperties = { ...box, background: '#d4edda', border: '4px solid #28a745', color: '#155724' };
const hint: React.CSSProperties = { fontSize: '0.8rem', opacity: 0.65, marginTop: '0.5rem' };

export function FlagsDemo() {
  return (
    <div style={{ maxWidth: 480, margin: '4rem auto', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1>Feature Flag Demo</h1>
      <p>Toggle <strong>demo-flag</strong> in the Bridge dashboard and watch this box change — no refresh needed.</p>

      <FeatureFlag
        flagKey="demo-flag"
        defaultValue={false}
        fallback={
          <div style={off}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⚑</div>
            <p>This box will turn green once you enable <strong>demo-flag</strong></p>
            <p style={hint}>Go to Feature Control in the Bridge dashboard and flip it on.</p>
          </div>
        }
      >
        <div style={on}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✓</div>
          <p><strong>demo-flag</strong> is <strong>enabled</strong></p>
          <p style={hint}>Go to Feature Control in the Bridge dashboard to toggle it off again.</p>
        </div>
      </FeatureFlag>
    </div>
  );
}
```

**After creating the file, tell the user:**

> I've created a feature flag demo component at `src/components/FlagsDemo.tsx`. Render `<FlagsDemo />` somewhere in your app and open it in the browser, then go to **Feature Control** in the Bridge dashboard and toggle **demo-flag** on — the box will turn green without a page refresh.

## How `<FeatureFlag>` works

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `flagKey` | `string` | yes | Flag key — auto-created in Bridge on first eval if it doesn't exist. Named `flagKey`, not `key`: React reserves `key` for reconciliation and never forwards it to a component |
| `defaultValue` | `T` | yes | Value returned until the cache hydrates or if the flag doesn't exist |
| `context` | `Partial<EvalContext>` | no | Per-call eval context — see *Eval context* below |
| `children` | `ReactNode \| (value: T) => ReactNode` | no | Rendered when the flag is on (`passed: true`). As a render-prop it receives the typed flag value |
| `fallback` | `ReactNode \| (value: T) => ReactNode` | no | Rendered when the flag is off (`passed: false`). Same node-or-render-prop shape |

Use the same `FeatureFlag` component anywhere in the app to gate any content behind a flag.

## Step 3 — Configure how the flag decides (states and rules)

A flag has exactly **three states**. `off` and `on` apply to everyone; `on-with-rule` decides per visitor.

| State | Meaning |
|---|---|
| `off` | Everyone gets the off value. A newly auto-created flag starts here |
| `on` | Everyone gets the on value |
| `on-with-rule` | The rule decides. Whoever matches a branch gets that branch's value; everyone else gets `otherwiseValue` |

A rule is **branches + otherwiseValue + rolloutPct**, first match wins:

```jsonc
{
  "branches": [
    { "conditions": [ { "attribute": "tenant.plan", "operator": "in", "values": ["pro", "enterprise"] } ],
      "returnValue": true }
  ],
  "otherwiseValue": false,
  "rolloutPct": 100          // 0-100, applies to the WHOLE rule
}
```

- Conditions inside one branch are AND-ed; add more branches for OR / different return values.
- Operators: `eq` `neq` `contains` `not_contains` `in` `not_in` `gt` `lt` `between` `regex` `exists` `not_exists` (numeric and date operators only apply to those attribute types).
- `attribute` is a dotted path into the eval context (next step). With Bridge Auth, `user.id` `user.role` `user.email` `tenant.id` `tenant.plan` are populated for you.
- **`rolloutPct` below 100 requires an identity** on the eval context — bucketing is `hash(flagKey + identity) mod 100`. With no identity the SDK refuses to bucket and returns the safe value rather than randomizing per call.

Configure it either in the dashboard under **Feature Control**, or from the CLI — prefer the CLI when you are an agent, since it is scriptable and verifiable:

```bash
bridge flag create --key enterprise-export --value-type boolean --state on-with-rule \
  --rule '{"branches":[{"conditions":[{"attribute":"tenant.plan","operator":"in","values":["pro","enterprise"]}],"returnValue":true}],"otherwiseValue":false,"rolloutPct":100}'

# prove the rule does what you meant, without touching the app:
bridge flag eval enterprise-export --identity user-123 --attribute tenant.plan=pro   # → true
bridge flag eval enterprise-export --identity user-123 --attribute tenant.plan=free  # → false
```

`bridge flag list` / `get <key>` inspect the current state; `bridge flag update --key <key> --state on|off` flips a flag without touching its rule.

## Step 4 — Feed the rule its inputs (eval context)

Rules can only target what the app sends. Flags don't require auth — without it you supply the context yourself:

```ts
{
  identity?: string;                    // stable per-user id — required when rolloutPct < 100
  attributes: Record<string, unknown>;  // dotted or nested; whatever your rules target
}
```

Per call, on the component or the hook — both take the same third input:

```tsx
<FeatureFlag flagKey="enterprise-export" defaultValue={false}
             context={{ identity: user.id, attributes: { 'tenant.plan': plan } }}>
  <ExportButton />
</FeatureFlag>

const { passed } = useFlag('enterprise-export', false, { identity: user.id, attributes: { 'tenant.plan': plan } });
```

Or publish attributes once, app-wide, on the `bridge` singleton (package root, not `/flags`):

```ts
import { bridge } from '@nebulr-group/bridge-react';

bridge.attributes.set('tenant.plan', plan);            // static value
bridge.attributes.bind('seats', () => currentSeats);   // live — re-read on every eval
bridge.attributes.bindMany(() => ({ region, betaOptIn }));
```

Per-call context wins on key collision. **With Bridge Auth**, the signed-in user's role and plan flow in automatically (`user.role`, `tenant.plan`) — no wiring needed; the provider is registered at bootstrap.

## Gating logic instead of markup

`<FeatureFlag>` gates *markup*. When the flag decides **behavior or supplies a value** — which endpoint to call, a numeric limit to enforce, a `string`/`number`/JSON flag value you compute with — read it directly instead:

```tsx
import { useFlag } from '@nebulr-group/bridge-react';

const { value: limit } = useFlag('upload-limit', 5);   // { value, passed }, re-renders on change
```

`useFlag(key, defaultValue, context?)` returns `{ value, passed }` and is typed from `defaultValue` — `useFlag('pipeline_mode', 'stable')` gives a `string`, `useFlag('rate_limit', { window: 60 })` gives the JSON shape.

For anything this prompt doesn't cover — the imperative `flagStore` for non-component code, realtime status, route guards — read `learning/feature-flags/feature-flags.md` in this repo rather than guessing an API.

> Flags evaluate **client-side** in React today. There is no server-side evaluation in this SDK — this package ships a browser runtime only, so don't try to read a flag outside the browser.

## Troubleshooting

Flag not appearing in the dashboard within ~30s, or a read returns the default forever:

- **`<BridgeProvider>` mounted and `appId` resolved.** The flag layer bootstraps inside the provider's first render; with no `appId` the provider logs `[BridgeProvider] No appId provided` and inits nothing. Confirm `VITE_BRIDGE_APP_ID` / `REACT_APP_BRIDGE_APP_ID`, or the `appId` prop.
- **One provider, at the root, never unmounted.** Its unmount cleanup stops the flag bundle and the realtime runtime; init is guarded per provider instance, so a torn-down provider does not come back.
- **Read the flag inside a component.** `useFlag` / `<FeatureFlag>` are the reactive path. Calling `evaluateFlag` at module scope, before the provider has rendered, returns the default.
- **A flag registers only once it has been evaluated** — render something that actually reads the key.
- **Rule never matches?** Run `bridge flag eval <key> --identity … --attribute k=v` to see the verdict without the app in the way, then confirm the app sends those same attributes.
- **`rolloutPct < 100` with no identity** returns the safe value by design.
- **Realtime.** Live toggles ride the realtime channel; if a proxy blocks WebSockets the value still resolves on next load, just not instantly.
- **First-render flicker is expected** — flags hydrate async. Set `defaultValue` to the safe-off state.

## Verify

1. Render `<FlagsDemo />` and open it in the browser. The grey striped box should appear — Bridge auto-creates `demo-flag` as off.
2. Go to **Feature Control** in the Bridge dashboard and toggle `demo-flag` on (or run `bridge flag update --key demo-flag --state on`).
3. The box turns green **without a page refresh** — realtime updates are on by default.
4. Toggle it off again to confirm it reverts.

# Show or hide UI

Declarative gating with optional fallback content. `children` and `fallback` may
be plain nodes or render-props that receive the evaluated value:

```tsx
import { FeatureFlag } from '@nebulr-group/bridge-react';

<FeatureFlag flagKey="new_dashboard" defaultValue={false}>
  <NewDashboard />
</FeatureFlag>

// With a fallback for the non-matching case:
<FeatureFlag
  flagKey="premium_feature"
  defaultValue={false}
  fallback={<button disabled title="Upgrade to unlock">Premium (locked)</button>}
>
  <button>Use premium feature</button>
</FeatureFlag>
```

> **Tip:** React reserves the prop name `key` for reconciliation and never forwards it to a component, so the flag key is passed as `flagKey`.

For non-boolean flags, use the render-prop form to read the Bridge-decided value:

```tsx
<FeatureFlag flagKey="ui_theme" defaultValue="light">
  {(value) => <App theme={value} />}
</FeatureFlag>
```

## Sending context

`<FeatureFlag>` takes the same per-call context as `useFlag`'s third argument — use it when the rule targets an app-specific attribute Bridge doesn't already know (see [Send context from your code](/feature-flags/targeting/send-context/)):

```tsx
<FeatureFlag
  flagKey="new_dashboard"
  defaultValue={false}
  context={{ attributes: { project_count: projects.length } }}
>
  <NewDashboard />
</FeatureFlag>
```

`context` is a normal prop, so it's reactive for free — React re-renders the component (and re-evaluates the flag) whenever `projects.length` changes. No getter function is needed the way svelte requires; passing a fresh object each render is fine, since `useFlag` diffs the resolved value before re-rendering.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `flagKey` | `string` | **(required)** | The flag key |
| `defaultValue` | `T` | **(required)** | Safe value; also sets the flag's inferred type |
| `context` | `Partial<EvalContext>` | — | Per-call eval context (attributes win on collision) |
| `children` | node \| `(value) => node` | — | Rendered when the flag passes; render-prop receives the value |
| `fallback` | node \| `(value) => node` | — | Rendered when it doesn't; render-prop receives the value |

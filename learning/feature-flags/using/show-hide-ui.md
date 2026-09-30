# Show or hide UI

The most common thing to do with a flag is decide whether a piece of UI renders at all. The `<FeatureFlag>` component does that declaratively, with optional fallback content for the off case. The render props receive the evaluated value:

```tsx
import { FeatureFlag } from '@nebulr-group/bridge-react/flags';

<FeatureFlag flagKey="new_dashboard" defaultValue={false}>
  <NewDashboard />
</FeatureFlag>

{/* With fallback for the non-matching case: */}
<FeatureFlag
  flagKey="premium_feature"
  defaultValue={false}
  fallback={<button disabled title="Upgrade to unlock">Premium (locked)</button>}
>
  <button>Use premium feature</button>
</FeatureFlag>
```

> **Framework note:** React reserves the prop name `key` for reconciliation and
> never forwards it to a component, so the flag key is passed as `flagKey`.
> `children` and `fallback` also accept plain nodes when you don't need the
> evaluated value.

## Why is it off?

A `fallback` render prop also receives why the feature is off, so you can offer an upgrade only when an upgrade would actually turn it on:

```tsx
<FeatureFlag
  flagKey="reports"
  defaultValue={false}
  fallback={(_value, { reason, feature }) =>
    reason === 'plan' ? <a href="/billing">Upgrade to get {feature ?? 'reports'}</a> : null
  }
>
  <Reports />
</FeatureFlag>
```

`reason` is `'plan'` (an upgrade alone would turn it on), `'permission'` (this person's role or privileges), `'off'`, `'rule'`, `'rollout'`, or `undefined` while the flag has not loaded. With `'plan'`, `feature` names the plan feature the rule asks for. `useFlag` returns the same `reason` and `feature`.

## Sending context

`<FeatureFlag>` takes the same per-call eval context (the identity and attributes a flag rule evaluates against) as `useFlag`'s third argument. Use it when the rule targets an app-specific attribute Bridge doesn't already know (see [Send context from your code](/feature-flags/targeting/send-context/)):

```tsx
<FeatureFlag
  flagKey="new_dashboard"
  defaultValue={false}
  context={{ attributes: { project_count: projects.length } }}
>
  <NewDashboard />
</FeatureFlag>
```

Since `context` is a plain prop, it's reactive for free: React re-evaluates the object expression (and re-renders the flag) whenever `projects.length` changes.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `flagKey` | `string` | **(required)** | The flag key |
| `defaultValue` | `T` | **(required)** | Safe value; also sets the flag's inferred type |
| `context` | `Partial<EvalContext>` | (none) | Per-call eval context (attributes win on collision) |
| `children` | node or `(value) => node` | (none) | Rendered when the flag passes; a render prop receives the value |
| `fallback` | node or `(value, { reason, feature }) => node` | (none) | Rendered when it doesn't; a render prop receives the value and why the feature is off |

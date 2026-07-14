# Use flags in your logic

`useFlag` returns a plain value — it isn't tied to markup. You'll often use it
to decide *what to render* (see [Show or hide UI](/feature-flags/using/show-hide-ui/)
for that, using the `<FeatureFlag>` component), but it's just as much for
deciding *what to do*: which function handles something, what limit to enforce,
which calculation to run. This page covers the `useFlag` API itself, starting
with the render case and then a pure-logic one.

## useFlag — reactive flag values

```tsx
import { useFlag } from '@nebulr-group/bridge-react';

export function Banner() {
  const { value } = useFlag('show_banner', false);
  return value ? <div className="banner">New stuff!</div> : null;
}
```

`useFlag(key, defaultValue, context?)` returns `{ value, passed }`:

| Field | Description |
|-------|-------------|
| `value` | The evaluated flag value, typed from your default (`boolean` \| `string` \| `number` \| JSON object) |
| `passed` | Whether a rule branch matched |

The result is **reactive**: when an admin changes the flag (or a live rule update arrives), the component re-renders with the new value. Under the hood `useFlag` subscribes to the flag change-bus via `useSyncExternalStore`, so it only re-renders when the resolved value actually changes. The default is mandatory — it's what your app gets when the flag isn't configured or Bridge is unreachable. A flag call can never break your app.

Unlike svelte, the arguments are plain values, not getter functions. `useFlag` re-evaluates whenever its inputs change across renders, so drive a reactive key or context off component state:

```tsx
const greeting = useFlag(
  `greeting_${locale}`,               // key changes with `locale`
  'Hello',
  { attributes: { locale } },         // per-call context changes with `locale`
);
```

## Branching plain logic, not markup

The same `useFlag` value works in a component body just as well as in JSX —
nothing renders, it just changes which code path runs:

```tsx
import { useFlag } from '@nebulr-group/bridge-react';

function usePricing() {
  const useV2Pricing = useFlag('pricing_engine_v2', false);
  const maxUploads = useFlag('max_uploads', 10);

  function calculateTotal(cart: CartItem[]): number {
    // Route to one implementation or the other — no UI involved.
    return useV2Pricing.value ? calculateTotalV2(cart) : calculateTotalV1(cart);
  }

  function canUploadMore(currentCount: number): boolean {
    // Gate an action with a value an admin can tune without a deploy.
    return currentCount < maxUploads.value;
  }

  return { calculateTotal, canUploadMore };
}
```

Both read the same live, reactive value as the rendering examples above — an
admin ramping `pricing_engine_v2` from 10% to 100%, or raising `max_uploads`
from 10 to 25, takes effect immediately, with no code change on your side.

Because `useFlag` is a hook, it has to be called at the top level of a component
or another hook. For a flag read in non-component code (a plain module, a util,
a test), use `flagStore` or the raw instance instead.

## flagStore — imperative subscribe variant

For code that prefers an imperative subscription (e.g. usage outside React components):

```ts
import { flagStore } from '@nebulr-group/bridge-react';

const banner = flagStore('show_banner', false);
const unsubscribe = banner.subscribe(({ value, passed }) => {
  // runs immediately, then re-runs on every live flag change
});
```

For a single non-reactive read, reach for the raw instance:

```ts
import { getBridgeFlagsInstance } from '@nebulr-group/bridge-react';

const { value } = getBridgeFlagsInstance()!.flag('show_banner', false);
```

## Multi-type values

One API for boolean, string, number, and JSON flags — the type is inferred from the default:

```ts
const isDark = useFlag('dark_mode', false);
const cta    = useFlag('checkout_text', 'Submit');
const limit  = useFlag('max_uploads', 10);
const cfg    = useFlag('rate_limit', { window: 60, max: 100 });
```

A type mismatch (admin stored a different type than your default suggests) returns the default and logs a warning.

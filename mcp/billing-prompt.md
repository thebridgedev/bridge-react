# Bridge React — Billing

You are wiring **billing UI** into a React (Vite / CRA) application that uses The Bridge. Plans and Stripe are already configured — this guide covers the frontend only: the subscription page, lifecycle notices, quota counters, and the paywall.

> **STOP — do not install any packages.** The only dependency is `@nebulr-group/bridge-react`, which is already installed. Do NOT install `@stripe/stripe-js` — the SDK redirects to Stripe Checkout via a plain URL redirect, no Stripe client library needed.

The whole billing surface ships from the **main entry** `@nebulr-group/bridge-react` — there is no `/billing` subpath (only `.`, `/flags`, and `/styles` exist). Snippets below import from the main entry to match the demo app.

## Prerequisites

Verify before starting:

```bash
bridge plan list
```

- At least one plan must be listed. If empty, run `bridge guide billing` (no `--framework`) first — the master prompt handles plan creation and Stripe setup, then comes back here.

```bash
bridge stripe status
```

- If any plan has a price, Stripe must be connected. If it isn't, `<PlanSelector>` will silently fail when a user picks a paid plan. Return to the master prompt (`bridge guide billing`) to connect Stripe before continuing. Free-only setups can skip this check.

- Bridge must be set up in this project:
  - `@nebulr-group/bridge-react` in `package.json`
  - `<BridgeProvider>` mounts at the root of the app (see the auth/flags guides)
  - `VITE_BRIDGE_APP_ID` (Vite) or `REACT_APP_BRIDGE_APP_ID` (CRA) set, or `appId` passed to `<BridgeProvider>`

## Step 1 — Subscription page

Create `src/pages/SubscriptionPage.tsx` (or wherever your routes live):

```tsx
import { PlanSelector } from '@nebulr-group/bridge-react';

export default function SubscriptionPage() {
  return (
    <div>
      <h1>Choose a plan</h1>
      <PlanSelector />
    </div>
  );
}
```

`<PlanSelector>` handles everything: loads plans, shows the current plan, routes free-plan selection directly (`selectFreePlan`), and launches Stripe Checkout for paid plans (`startCheckout` → redirect to the returned `checkoutUrl`). After payment or cancellation, Stripe returns through Bridge's unified callback handler, which syncs billing state and redirects the user. No redirect pages or URL configuration needed.

**`<PlanSelector>` props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `successRedirect` | `string` | `/subscription` | Where to send the user after a successful payment |
| `cancelRedirect` | `string` | `/subscription` | Where to send the user after a cancelled payment |
| `onSelect` | `(detail: { plan, price }) => void` | — | Called after free-plan selection or a plan change |
| `planCard` | `(ctx) => ReactNode` | — | Render-prop override for the default plan card |
| `emptyState` / `loadingState` | `ReactNode` | — | Override the empty / loading UI |

**Paywall (post-signup):** to drop the user straight into the app after first payment, set `successRedirect="/"`. The subscription syncs automatically on whichever page they land on.

## Step 2 — Billing notice banner

Add `<BridgeBillingNotice />` to your root layout. It renders nothing when billing is healthy and automatically shows the right message for payment failures, trial endings, cancellations, and dunning:

```tsx
import { BridgeBillingNotice } from '@nebulr-group/bridge-react';

<BridgeBillingNotice />
```

It reads `useBridge().subscription` (the Billing 2.0 lifecycle snapshot from auth-core) and renders for `past_due`, `trial_active`, `trial_ending_soon`, `cancel_at_period_end`, `canceled`, and the `dunning_*` states. Admins get a CTA; members get an informational banner. Props:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `chassis` | `'bar' \| 'rail' \| 'card'` | `'rail'` | Visual shell |
| `mode` | `'soft' \| 'hard'` | `'soft'` | `hard` renders a full lockscreen for the locked state |
| `onActionClick` | `(state) => void` | — | Override the default CTA (which navigates to `/billing`) |

## Step 2b — Plan-selection paywall (default)

Set this up by default: a signed-in tenant with no plan can't use the app until they pick one. Wrap your app in `<BridgePaywall>`:

```tsx
import { BridgePaywall } from '@nebulr-group/bridge-react';

<BridgePaywall successRedirect="/">
  <App />
</BridgePaywall>
```

`<BridgePaywall>` renders a fullscreen plan-selector modal when the session reports `shouldSelectPlan` (and `paymentsAutoRedirect` is not `false`), then disappears once a plan is chosen. Otherwise it just renders its children. Props:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `successRedirect` | `string` | `/` | Where to send the user after a successful Stripe payment |
| `cancelRedirect` | `string` | `/` | Where to send the user if they cancel Stripe Checkout |
| `onSelect` | `(detail: { plan, price }) => void` | — | Side-effect hook after free-plan or direct plan change |
| `heading` | `ReactNode` | — | Override the default "Choose a plan" heading |

The redirect is gated by the app-level `paymentsAutoRedirect` flag (**`true` by default**). To turn the whole paywall off so users reach the app without choosing a plan:

```bash
bridge app update --payments-auto-redirect false
```

**Alternative — dedicated welcome route.** If you'd rather redirect to a route than overlay in place, set `billing.paywallRoute` on `<BridgeProvider config={...}>` (e.g. `billing: { paywallRoute: '/welcome' }`) and render a `<PlanSelector>` on that route. The provider redirects planless users there before the app renders.

## Step 3 — Quota and entitlement UI (optional)

Skip if the plans have no per-resource limits or feature differences.

> Quotas and entitlements were configured in the master prompt (or the Bridge admin → **Plans**) via `bridge plan quota set` and `bridge plan entitlement set`. This step only surfaces them.

To show a live quota counter, drop in `<BridgeQuotaBanner metric="ai_completions" />` — it renders nothing below 80% of the cap, then a warning at 80–94% and a critical notice at ≥95%. It reads `useBridge().quota(metric)` and ticks live as usage is reported, no polling. Props: `metric` (required), `label`, `onActionClick`.

To gate a feature by entitlement, call `useBridge().entitlements.can('key')`:

```tsx
import { useBridge } from '@nebulr-group/bridge-react';

export function AnalyticsLink() {
  const bridge = useBridge();
  if (!bridge.entitlements.can('advanced_analytics')) return null;
  return <a href="/analytics">Open advanced analytics</a>;
}
```

`can()` returns `false` until hydrated (fail-closed) and flips live when the plan changes or a `hard` quota exhausts.

> **Note:** `useBridge` is also re-exported as `useBridgeBilling` from `@nebulr-group/bridge-react` — same accessor, either import works.

## Step 4 — Reporting usage

To make quota counters tick, report usage from your code. Fire-and-forget; the SDK queues durably:

```ts
import { getBridgeAuth } from '@nebulr-group/bridge-react';

getBridgeAuth().usage.report('ai_completions', 1); // value defaults to 1
```

Reporting to a metric not configured in the admin is accepted server-side but ticks no counter. Exceeding the cap always succeeds — the reaction is downstream (`metered` bills overage, `hard` flips the entitlement off).

## Reading subscription state

Two reads, depending on the call site:

- `useSubscription()` returns the Phase 1.0 status shape — `{ status, plans, loading, error }` — backed by the Zustand store. Good for plan name / "is there a plan" checks.
- `useBridge().subscription` is the Billing 2.0 lifecycle snapshot (`status`, `daysLeft`, `gateEngaged`, `recoveryUrl`, …). `<BridgeSubscriptionStatus />` is the ready-made display component for plan name + status badge.

Both update reactively — no polling. Import from `@nebulr-group/bridge-react`.

## What to expect in the dashboard

Plans, prices, quotas, and entitlements are configured at **app.thebridge.dev** (Plans) — never in code. Paid plans require a connected Stripe account; Checkout and the customer portal are Stripe-hosted. Lifecycle changes (payment failed, trial ending, cancellation) flow back over the realtime channel and update the notice/quota UI live.

## Standalone vs full-platform

- **Full platform:** billing rides the same `<BridgeProvider>` as auth and flags — the signed-in tenant's plan drives entitlements and quotas automatically.
- Billing UI assumes the user is authenticated (a tenant must exist to have a subscription). Set up **auth** first — see the auth guide. For feature gating, remember entitlements describe what the user *bought*; **feature flags** (see the flags guide) describe what's *exposed*.

## Billing checklist

Before verifying, confirm every item was applied:

- [ ] `bridge plan list` returns at least one plan
- [ ] `SubscriptionPage` created with `<PlanSelector>` (no props needed for the standard plan-change flow)
- [ ] `<BridgeBillingNotice />` added to the root layout
- [ ] Paywall: `<BridgePaywall>` wrapping the app (or `billing.paywallRoute` set on `<BridgeProvider>`)
- [ ] Quota/entitlement UI added if plans have limits
- [ ] No extra packages installed (`@stripe/stripe-js` must NOT be in package.json)

## Verify

1. Navigate to the subscription page — plan cards render with correct prices; a tier with monthly + yearly pricing shows both intervals.
2. Select a free plan — subscription updates immediately, no redirect.
3. Select a paid plan — Stripe Checkout launches.
4. Complete payment — redirected back with the updated plan showing.
5. Cancel payment — redirected to the cancel target.
6. Paywall: sign in as a new tenant with no plan — the paywall modal blocks the app until a plan is chosen.
7. Run the project's build command — no TypeScript or import errors.

---

> **If you are running this guide as part of `bridge guide billing` (the master prompt):** this guide is now complete. Return to the master and continue with the remaining steps (paywall, verification, success banner, follow-on tracks). Do not stop here.

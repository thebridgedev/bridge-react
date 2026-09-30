# Add billing to your app

**Step 3 of 3.** With [Stripe connected](/billing/setup/connect-stripe/) and your
[plans defined](/billing/setup/define-plans/), you can now use billing inside your
app. You can detect a first-time user and show them your plans, give users a
subscription page to upgrade or downgrade, and surface billing statuses, like a
payment that didn't go through. This page briefly covers each capability and links
out where we go deeper.

## Prerequisite: auth + bootstrap

Billing rides on the same setup as auth. Before anything here works you need
Bridge auth configured and `<BridgeProvider>` mounted at your app root.
See [Authentication](/auth/) if you haven't done that yet, and
[How billing works](/billing/how-it-works/) for the model.

## Billing state is already live, with no init call

Once `<BridgeProvider>` mounts at your app root, billing is **already live**.
The provider fetches
the subscription for the current workspace (called a *tenant* in the API),
connects the live channel, and honors your configured billing routes.
There is **no separate billing init call**.

State lands on the unified `bridge` object and updates over the live channel
(a persistent realtime connection the SDK maintains):

```tsx
import { bridge, useBridgeReadable } from '@nebulr-group/bridge-react';

function PlanSummary() {
  const subscription = useBridgeReadable(bridge.tenant.subscription);   // plan, status, trial
  const entitlements = useBridgeReadable(bridge.tenant.entitlements.snapshot); // what the plan grants

  if (!subscription) return null;
  return <p>Plan: {subscription.plan.name} ({subscription.status})</p>;
}
```

## Mount the subscription pages

One route serves the subscription page, the paywall and both pages a Stripe checkout returns to. With React Router:

```tsx
// src/App.tsx
import { BridgeBillingRoutes } from '@nebulr-group/bridge-react/react-router';

<Routes>
  {/* …your routes */}
  <Route path="/subscription/*" element={<BridgeBillingRoutes />} />
</Routes>
```

With TanStack Router, import it from `@nebulr-group/bridge-react/tanstack-router` and mount it on a `subscription/$` route; without a router, render `<BridgeBillingRoutes base="/subscription" />` from the main entry.

| Address | Page |
|---------|------|
| `/subscription` | The current plan, "Manage billing" and the plan picker |
| `/subscription/plan` | The paywall: where a workspace with no plan is sent |
| `/subscription/success` | Where a completed checkout (or a free pick) lands |
| `/subscription/error` | Where a failed checkout confirmation lands |

Those addresses are the defaults of the `billing` settings on `<BridgeProvider config>`, so nothing Bridge redirects to is a 404:

| Setting | Default | What it does |
|---------|---------|--------------|
| `billing.manageRoute` | `'/subscription'` | Where Upgrade/Manage buttons and the upgrade dialog link |
| `billing.paywallRoute` | `'/subscription/plan'` | Where a signed-in workspace with no plan is redirected **as soon as the provider mounts**. The default applies only when the app has plans; `false` turns the redirect off. Workspaces that opt out via `paymentsAutoRedirect: false` are exempt |
| `billing.paymentErrorRoute` | `'/subscription/error'` | Where Bridge sends the user if a Stripe checkout confirmation fails on the return trip |

Set one only to move it, e.g. `billing: { paywallRoute: '/welcome' }` for an onboarding page of your own (see [Require a plan](/billing/onboarding/require-plan/)). To restyle or take over a page, pass `frame`, `heading` or `pages={{ plan: <MyPricing /> }}` — the same props as the sign-in pages.

## Adding billing to your UI

Here are three use cases for billing in your UI:

**1. Letting users select a plan after first signup**: nothing to write. A
brand-new workspace with no plan is sent to `/subscription/plan` before it gets
in. To gate in place with a modal instead, wrap your app in `<BridgePaywall>` and
set `billing: { paywallRoute: false }`.

→ [Require a plan to use the app](/billing/onboarding/require-plan/)

**2. A self-service subscription page**: `/subscription`, served above. It
shows the current plan and all the plans, so your users can upgrade or downgrade
directly from your app. `<PlanSelector />` is the picker it is built from, for a
page of your own.

→ [Choose & switch plans](/billing/onboarding/choose-switch-plans/)

**3. Surface billing health**: `<BridgeBillingNotice />` renders nothing while
the subscription is healthy and the right banner (trial ending, payment failed,
canceled) when it needs attention. Put it once in your root layout:

```tsx
import { BridgeBillingNotice } from '@nebulr-group/bridge-react';

<BridgeBillingNotice />
```

→ [Warn about billing problems](/billing/status/billing-notices/)

> That's the whole quickstart. From here, the rest of the billing section covers
> depth: [subscription status](/billing/status/subscription-status/),
> [usage limits](/billing/limits/usage-limits/),
> [free trials](/billing/lifecycle/free-trials/),
> [the billing portal](/billing/lifecycle/billing-portal/), and
> [failed-payment handling](/billing/lifecycle/failed-payments/), each building
> on the live `bridge` object you now have wired up.

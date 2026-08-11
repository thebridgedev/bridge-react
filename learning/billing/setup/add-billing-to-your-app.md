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

## Configure your billing routes

Add a `billing` block to the `BridgeConfig` you already pass to `<BridgeProvider>`:

```tsx
// src/main.tsx
import { BridgeProvider, type BridgeConfig } from '@nebulr-group/bridge-react';
import { createRoot } from 'react-dom/client';
import App from './App';

const config: BridgeConfig = {
  appId: import.meta.env.VITE_BRIDGE_APP_ID,
  loginRoute: '/auth/login',
  billing: {
    paywallRoute: '/subscription',       // send plan-less workspaces here
    paymentErrorRoute: '/payment-error', // land here if a checkout confirmation fails
  },
};

createRoot(document.getElementById('root')!).render(
  <BridgeProvider config={config}>
    <App />
  </BridgeProvider>
);
```

- **`paywallRoute`**: when set, the provider redirects an authenticated workspace
  that hasn't selected a plan here **as soon as it mounts**. Point it at
  wherever your `<PlanSelector>` lives. (Workspaces that opt out via
  `paymentsAutoRedirect: false` are exempt.)
- **`paymentErrorRoute`**: where Bridge sends the user if a Stripe checkout
  confirmation fails on the return trip. Defaults to `/payment-error`.

Both are optional. Leave `paywallRoute` unset if you'd rather gate the app with
`<BridgePaywall>` (below) than redirect.

## Adding billing to your UI

Here are three use cases for billing in your UI:

**1. Letting users select a plan after first signup**: wrap your root layout in
`<BridgePaywall>`; it blocks the app and shows a plan picker until the workspace
has an active plan, so a brand-new user picks a plan before they get in:

```tsx
// src/App.tsx
import { BridgePaywall } from '@nebulr-group/bridge-react';
import { Routes } from './Routes';

export default function App() {
  return (
    <BridgePaywall successRedirect="/welcome" cancelRedirect="/subscription">
      <Routes />
    </BridgePaywall>
  );
}
```

→ [Require a plan to use the app](/billing/onboarding/require-plan/)

**2. A self-service subscription page**: drop `<PlanSelector />` onto a route. It
loads all the plans so your users can upgrade or downgrade directly from your app:

```tsx
// src/pages/SubscriptionPage.tsx
import { PlanSelector } from '@nebulr-group/bridge-react';

export default function SubscriptionPage() {
  return <PlanSelector successRedirect="/subscription/success" cancelRedirect="/subscription" />;
}
```

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

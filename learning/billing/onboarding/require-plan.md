# Require a plan to use the app

Some apps shouldn't do anything until the workspace (called a *tenant* in the API) is on a plan. "Requiring a plan" means blocking the app until the current workspace has an **active plan**, and letting it through the moment one exists.

A plan counts as active once the workspace has either:

- **selected a free plan** (instant, no payment involved), or
- **completed Stripe Checkout for a paid plan** (a payment method is captured).

Under the hood the gate keys off a single flag on the subscription status: **`shouldSelectPlan`**. While it's `true` the workspace has no active plan and the app should stay blocked; once a plan is selected or checked out it flips to `false` and the app opens up. You never compute this yourself; Bridge derives it from the workspace's billing state. (This is the onboarding gate. A workspace that *had* a plan and lost it, say after exhausted payment retries, is **billing-locked** instead, which is a separate signal. See [How billing works](/billing/how-it-works/#when-billing-locks-the-app) for how the two relate.)

There are three ways to enforce the gate. The first needs no code.

## Method 1: the default paywall page

With `<BridgeBillingRoutes>` mounted at `/subscription/*` (see [Add billing to your app](/billing/setup/add-billing-to-your-app/)), `<BridgeProvider>` sends a signed-in workspace with no plan to **`/subscription/plan`** as soon as it mounts. That page shows the plan picker; a completed checkout lands on `/subscription/success`.

The default applies only to an app that has plans: in an app without billing every workspace is plan-less, and nobody is redirected. It only redirects when all of the following hold, so there's no redirect loop and no gate on exempt workspaces:

- `billing.paywallRoute` is not `false`
- the current path isn't the paywall route, or the payment-error page (a failed checkout must stay readable)
- no Stripe checkout confirmation is still in flight
- the workspace is authenticated but has `shouldSelectPlan: true`
- the workspace hasn't opted out via `paymentsAutoRedirect: false`

> **Framework note:** the provider sits above your router, so it redirects through Bridge's router adapter. `<BridgeBillingRoutes>` / `<BridgeAuthRoutes>` from `@nebulr-group/bridge-react/react-router` (or `/tanstack-router`) register your router for you; without them the redirect is a full page load.

## Method 2: your own onboarding page

When the paywall should be a page of yours, e.g. `/welcome` with its own copy, render `<BridgePaywallPage>` there and point `billing.paywallRoute` at it. The redirect happens before that page has ever been visited, so it has to know the address — that is what the config line is for. (Mounted anywhere else, the page says so in the development console.)

```tsx
// src/main.tsx
<BridgeProvider config={{ billing: { paywallRoute: '/welcome' } }}>
  <App />
</BridgeProvider>

// src/App.tsx
import { BridgePaywallPage } from '@nebulr-group/bridge-react';

<Route path="/welcome" element={<BridgePaywallPage heading="Pick a plan to get started"><p>Welcome aboard.</p></BridgePaywallPage>} />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `heading` | `ReactNode` | `'Choose a plan'` | The page heading |
| `children` | `ReactNode` | (none) | Content between the heading and the plans |
| `successRedirect` | `string` | `<billing.manageRoute>/success` | Where a completed checkout lands |
| `cancelRedirect` | `string` | this page | Where a cancelled checkout lands |
| `onSelect` | `({ plan, price }) => void` | (none) | Called after a free-plan or direct plan change (not the Stripe redirect path) |

Keep that route reachable for a signed-in, plan-less user (don't put a gate of your own in front of it).

## Method 3: `<BridgePaywall>` overlay

To gate in place instead of redirecting, wrap your app in `<BridgePaywall>` and turn the redirect off with `billing: { paywallRoute: false }`. While `shouldSelectPlan` is true it renders a full-screen modal with a `<PlanSelector>` inside; otherwise it renders its children (your app).

```tsx
// src/App.tsx
import { BridgePaywall } from '@nebulr-group/bridge-react';
import { Routes } from './Routes';

export default function App() {
  return (
    <BridgePaywall successRedirect="/" cancelRedirect="/">
      {/* your app: only rendered once a plan is active */}
      <Routes />
    </BridgePaywall>
  );
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `successRedirect` | `string` | `'/'` | Where to send the user after a successful Stripe payment |
| `cancelRedirect` | `string` | `'/'` | Where to send the user if they cancel checkout |
| `onSelect` | `({ plan, price }) => void` | (none) | Called after free-plan selection or a direct plan change (not the Stripe redirect path); use for analytics side-effects |
| `heading` | `ReactNode` | "Choose a plan" | Override the modal heading |
| `children` | `ReactNode` | (none) | Your app. Rendered only once a plan is active |

> **Tip:** `<PlanSelector>` is the same picker every method renders. See [Choose & switch plans](/billing/onboarding/choose-switch-plans/) for its full prop table and customization options.

## The end-to-end flow

Every method drives the same underlying flow:

1. A user signs in to a workspace that has **no active plan** → `shouldSelectPlan` is `true`.
2. The **gate** engages: `<BridgeProvider>` redirects to the paywall page (`/subscription/plan`, or your own), or the `<BridgePaywall>` modal appears.
3. The user picks a plan from the `<PlanSelector>`:
   - **Free plan** → activated instantly, no payment. The picker goes on to `successRedirect` (or, when you pass `onSelect`, calls it and stays put).
   - **Paid plan** → the user is sent to **Stripe Checkout** to capture a payment method.
4. On successful payment the user returns to your app at **`successRedirect`**; if they cancel, they land on **`cancelRedirect`**.
5. With a plan now active, `shouldSelectPlan` flips to `false` → the **gate opens** and your app renders.

## Opting out: `paymentsAutoRedirect: false`

`paymentsAutoRedirect` is a flag on the subscription status. When it's `false`, the workspace **has opted out of the platform's native plan-selection gate**; such workspaces are exempt from the automatic block. Every method above respects it: `<BridgePaywall>` renders its children instead of the modal, and `<BridgeProvider>` skips the paywall redirect entirely.

This exists so certain workspaces can bypass the forced plan choice, for example accounts provisioned or billed out-of-band, where forcing a plan selection in the app would be wrong. Those workspaces still reach your app normally; you're free to render your own `<PlanSelector>` where it makes sense, but the platform won't block them for you.

`successRedirect` and `cancelRedirect` are independent of this flag; they're simply where the user lands after leaving Stripe Checkout (success or cancel, respectively). They default to `'/'` on `<BridgePaywall>`.

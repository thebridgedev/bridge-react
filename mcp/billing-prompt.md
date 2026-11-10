# Bridge React — Billing

You are wiring **billing UI** into a React (Vite / CRA) application that uses The Bridge. Plans and Stripe are already configured — this guide covers the frontend only: the subscription page, lifecycle notices, quota counters, and the paywall.

> **STOP — do not install any packages.** The only dependency is `@nebulr-group/bridge-react`, which is already installed. Do NOT install `@stripe/stripe-js` — the SDK redirects to Stripe Checkout via a plain URL redirect, no Stripe client library needed.

The billing surface ships from the **main entry** `@nebulr-group/bridge-react`. The only other entries are `/flags`, `/styles`, and the router adapters `/react-router` and `/tanstack-router` (which export `BridgeBillingRoutes` bound to that router). There is no `/billing` subpath.

## The one rule for app code

**Every gate in app code is a flag.** A link, a page, a button, an endpoint: if some people get it and others do not, the code asks a flag, and the flag's rule says why: a privilege (`privileges contains "USER_WRITE"`), a plan feature (`bridge:billing.entitlement.analytics eq true`) or a rollout. App code never reads a role, a privilege list, the plan or a plan feature to decide what someone may see or do.

Two things are not gates and are not flags: **numbers** are plan limits (`<QuotaGate>` in the browser, `@RequireQuota` on the backend), and **permission on one specific record** stays in app code ("only the author edits their post").

Before calling the work done, run `npx @nebulr-group/bridge-cli check gates` in the project. It lists every direct role, privilege, plan or plan-feature check with the flag to use instead. Fix each one.

In React: a piece of UI is `<FeatureFlag flagKey="…">`; a page is a guard component built on `useFlag` (see the flags guide); a nav link is the same `<FeatureFlag>` around the link.

**The rules this guide follows** (full version: `learning/mechanisms.md`):

- One route serves every subscription page. Do not hand-write a subscription, success, cancel, `/billing` or `/payment-error` page.
- Count usage once, where the action happens: a backend that does the work counts it (`@RequireQuota`); the browser counts only what never reaches a server (`bridge.usage`).
- Do not write a quota `if`, a "limit reached" toast or a `/quota` endpoint: level 0 (the upgrade dialog on a `402`) already covers the refusal.

## Decide first — which billing surface do you need?

Billing is not one component. Pick the rows that match what the app has to do; most apps need the first three.

| You want | Use | What it does |
|---|---|---|
| **The subscription page, the paywall and the checkout return pages** | `<BridgeBillingRoutes />` on `/subscription/*` | Serves `/subscription` (current plan, Manage billing, plan picker), `/subscription/plan` (paywall), `/subscription/success`, `/subscription/error` |
| **The app unusable until the workspace has a plan** | Nothing more | With plans, `<BridgeProvider>` redirects a plan-less workspace to `/subscription/plan` before the app renders |
| To warn about payment failures, trials, cancellation | `<BridgeBillingNotice />` in the root layout | Renders nothing while billing is healthy; picks the right message and CTA per lifecycle state |
| The upgrade path when a plan limit is hit | Nothing (level 0) | Your backend's `402 QUOTA_EXCEEDED` opens the upgrade dialog `<BridgeProvider>` mounts |
| A button that stops at the limit | `<QuotaGate metric="…">` (level 1) | Disables the controls inside at a known hard cap, with an upgrade line |
| Your own quota UI | `useQuota(metric)` (level 2) | Live `{ loading, unlimited, used, limit, remaining, warningLevel, kind }` |
| A live usage warning banner | `<BridgeQuotaBanner metric="…" />` | Silent below 80% of the cap, warning at 80–94%, critical at ≥95% |
| To hide a feature the plan didn't buy | `<FeatureFlag flagKey="…" defaultValue={false} upgrade>` with the flag ruled `bridge:billing.entitlement.<key> eq true` | Shows the feature on plans that include it, an "Upgrade to use this" button elsewhere |

**A feature a plan sells is still gated by a flag** — that is the last row above, and it does not contradict the one rule. The plan lists the feature (what the workspace *bought*); the flag's rule reads that list (`bridge:billing.entitlement.<key> eq true`), so the flag is on exactly for the workspaces whose plan includes it. The rule never names plans, so changing what a plan sells is one edit on the plan. See *Plan features* in Step 3.

## Configuring plans, prices and quotas

These can be configured from the Bridge **MCP tools** or the **`bridge` CLI**. Same operations, same API:

| Operation | MCP | CLI |
|---|---|---|
| List plans (with prices + quotas) | `list_plans` | `bridge plan list` / `bridge plan get <key>` |
| Create a plan | `create_plan` — `key`, `name`, `description?`, `trial?`, `trialDays?` | `bridge plan create --key … --name …` |
| Edit a plan | `update_plan` — `key`, `name?`, `description?` | `bridge plan update --key … --name …` |
| Add/replace a price | `set_plan_price` — `key`, `amount`, `interval`, `currency?` | `bridge plan price set <key> --amount … --interval …` |
| Remove a price | `remove_plan_price` — `key`, `interval`, `currency?` | `bridge plan price rm <key> --interval …` |
| Add/replace a quota | `set_plan_quota` — `key`, `metric`, `limit`, `policy`, `kind?`, `priceAmount?`, `priceCurrency?` | `bridge plan quota set <key> --metric … --limit … --policy … [--kind gauge]` |
| Remove a quota | `remove_plan_quota` — `key`, `metric` | `bridge plan quota rm <key> --metric …` |
| Sell an on/off feature on a plan | `add_plan_feature` | `bridge plan feature add <key> <feature> --name "…"` |
| Stop selling it on a plan | `remove_plan_feature` | `bridge plan feature remove <key> <feature>` |

Use whichever is already set up. **If the user asks for a specific surface, use that one** — both reach the same API. If neither is available, offer to install one; only fall back to the dashboard if they decline.

**Counter or gauge?** If deleting it frees room, it's a gauge and your app counts it; if it happened, it's a counter and Bridge counts it. Projects, seats and documents are gauges (`kind: "gauge"` — "8 of 10 projects", never reset); AI completions, exports and API calls are counters (the default — "40 of 100 this month", reset each period). Every gauge value comes from your app, except seats.

**Seats** are a plan limit the app names (`seats`), kind gauge, that Bridge counts from workspace membership, pending invites included: `bridge plan quota set <plan> --metric seats --limit N --policy hard --kind gauge --source membership` (MCP: `set_plan_quota` with `kind: "gauge"`, `source: "membership"`). There is no built-in `users` metric. Ask whether invites go through Bridge's built-in team page or the app's own invite handler. Built-in team page: `<TeamManagementPanel seatsMetric="seats" />`, and Invite stops at the limit. Own handler: `@RequireQuota('seats')` on it. Bridge's invite API does not refuse at the limit, so one of the two must be in place. Never gate seats with a flag or an entitlement: a seat count is a limit.

## Prerequisites

Verify before starting:

```bash
bridge plan list        # MCP: list_plans
```

- At least one plan must be listed. If empty, run `bridge guide billing` (no `--framework`) first — the master prompt handles plan creation and Stripe setup, then comes back here.

```bash
bridge stripe status
```

- If any plan has a price, Stripe must be connected. If it isn't, `<PlanSelector>` will silently fail when a user picks a paid plan. Return to the master prompt (`bridge guide billing`) to connect Stripe before continuing. Free-only setups can skip this check.

- Bridge must be set up in this project:
  - `@nebulr-group/bridge-react` in `package.json`
  - `<BridgeProvider>` mounts at the root of the app (see the auth/flags guides)
  - `VITE_BRIDGE_APP_ID` (Vite) or `REACT_APP_BRIDGE_APP_ID` (CRA) set, or `appId` passed to `<BridgeProvider config>` (an explicit option wins over the environment)

## Step 1 — Mount the subscription pages

```tsx
// src/App.tsx — React Router
import { BridgeBillingRoutes } from '@nebulr-group/bridge-react/react-router';

<Routes>
  {/* …your routes */}
  <Route path="/subscription/*" element={<BridgeBillingRoutes />} />
</Routes>
```

```tsx
// TanStack Router
import { BridgeBillingRoutes } from '@nebulr-group/bridge-react/tanstack-router';

const subscriptionRoute = createRoute({ getParentRoute: () => rootRoute, path: 'subscription/$', component: BridgeBillingRoutes });
```

Without a router: `<BridgeBillingRoutes base="/subscription" />` from the main entry.

That one route is the whole subscription surface:

| Address | Page | Config default it serves |
|---|---|---|
| `/subscription` | Current plan, "Manage billing" (`<BillingPortalButton>`), plan picker. A completed checkout or a Free pick lands here with a confirmation banner | `billing.manageRoute`; also `billing.successRoute` |
| `/subscription/plan` | The paywall | `billing.paywallRoute` |
| `/subscription/success` | An optional separate confirmation page; used only when `billing.successRoute` points at it | (none) |
| `/subscription/error` | Where a failed checkout confirmation lands | `billing.paymentErrorRoute` |

The plan picker loads plans cheapest first, shows interval tabs and each plan's features, selects a free plan directly, confirms before an instant switch, and launches Stripe Checkout for a paid plan. Stripe returns through Bridge's callback (served by `<BridgeAuthRoutes>` on `/auth/*`), which confirms the checkout and lands on `billing.successRoute` (the subscription page, which shows a confirmation banner).

**Landing somewhere else after checkout.** If the developer wants users back in the app after paying, set `billing: { successRoute: '/dashboard' }` (their page) on `<BridgeProvider config>`. To confirm it there, render `<BridgeCheckoutNotice />` on that page or in the layout; it shows once, only right after a checkout. For custom copy, read `useCheckoutResult()` and call `clearCheckoutResult()` once the message has been seen. `<BridgeBillingRoutes checkoutNotice={false} />` hides the banner on the subscription page. Do not build a confirmation page by hand.

To customise: `--bridge-*` tokens; then `frame(page, children)` / `heading(page)` on `<BridgeBillingRoutes>`; then take one page over by element, `pages={{ plan: <MyPricing /> }}`, building it from `<PlanSelector>` (render props `planCard`, `planDescription`, `planFooter`).

## Step 2 — Billing notice banner

Add `<BridgeBillingNotice />` to your root layout. It renders nothing when billing is healthy and automatically shows the right message for payment failures, trial endings, cancellations, and dunning:

```tsx
import { BridgeBillingNotice } from '@nebulr-group/bridge-react';

<BridgeBillingNotice />
```

It reads the Billing 2.0 lifecycle snapshot from auth-core's billing surface (`useBridgeBilling().subscription`) and renders for `past_due`, `trial_active`, `trial_ending_soon`, `cancel_at_period_end`, `canceled`, and the `dunning_*` states. Admins get a CTA; members get an informational banner. Props:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `chassis` | `'bar' \| 'rail' \| 'card'` | `'rail'` | Visual shell |
| `mode` | `'soft' \| 'hard'` | `'soft'` | `hard` renders a full lockscreen for the locked state |
| `onActionClick` | `(state) => void` | — | Override the default CTA click handler |
| `actionHref` | `string` | — | CTA destination for this instance; falls back to `billing.manageRoute` (default `/subscription`) |

The CTA navigates to, in priority order: `onActionClick` → `actionHref` → `billing.manageRoute` (default `/subscription`, the page Step 1 mounted). Nothing to configure.

## Step 2b — Plan-selection paywall (on by default)

Nothing to write. When the app has plans, `<BridgeProvider>` sends a signed-in workspace with no plan to `/subscription/plan` before the app renders, and lets it through once a plan is active. The redirect respects the app-level `paymentsAutoRedirect` flag (**`true` by default**):

```bash
bridge app update --payments-auto-redirect false   # turn the paywall off for the app
```

Variations, only when the user asks for them:

- **An onboarding page of your own** (e.g. `/welcome`): a product decision — ask, never create it unasked. If yes, render `<BridgePaywallPage heading="…" />` on that route and set `billing: { paywallRoute: '/welcome' }` on `<BridgeProvider config>`.
- **A modal instead of a redirect:** wrap the app in `<BridgePaywall>` and set `billing: { paywallRoute: false }`.

## Step 3 — Plan limits in the UI (optional)

Skip if the plans have no per-resource limits or feature differences.

> Quotas and plan features were configured in the master prompt (or the Bridge admin → **Plans**) via `bridge plan quota set` and `bridge plan feature add`. This step only surfaces them.

Pick the lowest level that does the job:

**Level 0 — nothing.** Call your backend with `bridgeFetch` (it adds the user's token). When the backend refuses at the cap (`402 { code: 'QUOTA_EXCEEDED', metric, used, limit, fix }`, what bridge-nestjs `@RequireQuota` sends), `<BridgeProvider>` opens an upgrade dialog naming the metric; a member who cannot manage billing is told to ask the owner. A plain `fetch` to the page's own origin is recognised too; another origin goes in `billing.apiOrigins`. `billing.upgradeDialog: false` turns it off (use `onBridgeQuotaExceeded(handler)`), a component replaces it.

```tsx
import { bridgeFetch } from '@nebulr-group/bridge-react';

<button onClick={() => bridgeFetch('/api/tickets', { method: 'POST' })}>New ticket</button>
```

**Level 1 — one component.**

```tsx
import { QuotaGate, FeatureFlag } from '@nebulr-group/bridge-react';

<QuotaGate metric="tickets">
  <button onClick={createTicket}>New ticket</button>
</QuotaGate>

{/* the flag's rule: bridge:billing.entitlement.analytics eq true */}
<FeatureFlag flagKey="analytics" defaultValue={false} upgrade>
  <a href="/analytics">Analytics</a>
</FeatureFlag>
```

`<QuotaGate>` never disables while loading, on an unlimited metric or on a metered quota; `atLimit={(q) => …}` replaces its default upgrade line. `upgrade` on `<FeatureFlag>` shows an "Upgrade to use this" button only when the plan is why the feature is off.

**Level 2 — your own UI.**

```tsx
import { useQuota } from '@nebulr-group/bridge-react';

const tickets = useQuota('tickets');
// tickets.loading → numbers are null (never 0); tickets.unlimited → no quota on this plan
// otherwise tickets.used / tickets.limit / tickets.remaining, live
```

`<BridgeQuotaBanner metric="…" />` is a ready-made warning banner on top of the same data (silent below 80%).

### Plan features — a flag ruled on the plan's list

An on/off feature that some plans sell (analytics, SSO, AI) is two pieces: the plan lists it, and a flag reads that list. The flag's rule never names plans, so when Pro gains or loses the feature you change the plan and no rule has to follow.

1. Put the feature on each plan that sells it: `bridge plan feature add pro analytics --name "Analytics"` (MCP: `add_plan_feature`).
2. Create the flag with the rule `bridge:billing.entitlement.analytics eq true` (MCP: `create_feature_flag` with the same rule as a structured object):

```bash
bridge flag create --key analytics --value-type boolean --state on-with-rule \
  --rule '{"branches":[{"conditions":[{"attribute":"bridge:billing.entitlement.analytics","operator":"eq","values":[true]}],"returnValue":true}],"otherwiseValue":false,"rolloutPct":100}'
```

3. Gate on the flag: `<FeatureFlag flagKey="analytics" defaultValue={false} upgrade>` around the markup (Level 1 above). For your own prompt, pass `fallback={(value, { reason, openUpgrade }) => …}` instead: `reason` is `'plan'` when an upgrade alone would turn it on. A whole page is a guard component built on `useFlag('analytics', false)`. On the backend, `@RequireFeatureFlag('analytics')` reads the same rule.

The flag can later carry a rollout, a trial group or a one-customer exception without a code change — which a direct plan check cannot.

**Never put a flag ruled on `bridge:billing.entitlement.tickets` around `<QuotaGate metric="tickets">`.** Every hard quota is also an entitlement of the same name, `false` at the cap — the flag would hide the button and the gate's upgrade line with it. Plan *features* (`analytics`, `sso`) are flags; *counted* things (`tickets`, `projects`) are `<QuotaGate>`.

### Exceptions — checking the plan directly

`<Entitled to="analytics">` and `useEntitlements().can('analytics')` read the plan's list with no flag in between. Use them only when the developer explicitly asks for no flag; in development they print a one-time note pointing at the flag rule. `can(key)` is fail-closed (`false` until Bridge has answered), and `<Entitled>` renders nothing, or its `loading` node, until then.

## Step 4 — Counting usage

**Count once, where the action happens.** When the click calls your backend, the backend handler counts it (`@RequireQuota` / `@SyncQuota`) and the page reports nothing. Only when the action never reaches a server of yours (local-first, data on the device) does the browser count it:

```ts
import { bridge } from '@nebulr-group/bridge-react';

bridge.usage.report('exports');                        // a counter: it happened
await bridge.usage.set('projects', projects.length);   // a gauge: how many exist now
```

Never both for one metric. In development the plugin warns once when the backend and the page count the same metric.

## Reading subscription state

Two reads, depending on the call site:

- `useBridgeReadable(bridge.tenant.subscription)` returns the canonical plan and status (`{ plan: { slug, name }, status, endsAt }`, `null` until the first session snapshot). It moves live on a plan change. Good for plan name / "is there a plan" checks.
- `useQuota(metric)` / `useEntitlements()` for plan limits and plan features (Step 3).
- `useSubscription()` returns the checkout-flow status shape (`{ status, plans, loading, error }`) from the Zustand store. Call `loadSubscription()` to populate it; it is what `<PlanSelector>` uses.
- `useBridgeBilling().subscription` is auth-core's Billing 2.0 lifecycle store (`status`, `daysLeft`, `gateEngaged`, `recoveryUrl`, …) behind the billing notice. `<BridgeSubscriptionStatus />` is the ready-made display component for plan name + status badge.

Import all of them from `@nebulr-group/bridge-react`.

**The billing screens stay current on their own.** `<PlanSelector>`, `<BridgeSubscriptionStatus>`, `<BridgeBillingNotice>` and the subscription pages re-read the plan list, the current plan and the billing state when the sign-in is renewed, when a live plan, subscription or payment event arrives, and when the tab regains focus more than 30 seconds after the last read. A plan created, changed or removed in Bridge appears without a reload. Do not add polling, a refresh button or a `useEffect` that calls `loadSubscription()` on an interval.

## What to expect in the dashboard

Plans, prices, quotas, and entitlements are configured at **app.thebridge.dev** (Plans) — never in code. Paid plans require a connected Stripe account; Checkout and the customer portal are Stripe-hosted. Lifecycle changes (payment failed, trial ending, cancellation) flow back over the realtime channel and update the notice/quota UI live.

## Standalone vs full-platform

- **Full platform:** billing rides the same `<BridgeProvider>` as auth and flags — the signed-in tenant's plan drives entitlements and quotas automatically.
- Billing UI assumes the user is authenticated (a tenant must exist to have a subscription). Set up **auth** first — see the auth guide. For feature gating, the plan lists what the workspace *bought* and a **feature flag** ruled on that list (see the flags guide) decides what is shown.

## Billing checklist

Before verifying, confirm every item was applied:

- [ ] `bridge plan list` returns at least one plan
- [ ] `<Route path="/subscription/*" element={<BridgeBillingRoutes />} />` (or the TanStack `subscription/$` route) mounted, and `/auth/*` → `<BridgeAuthRoutes />` mounted (the Stripe return comes back through it)
- [ ] No hand-written subscription, success, cancel, `/billing` or `/payment-error` page
- [ ] `<BridgeBillingNotice />` added to the root layout
- [ ] No quota `if`, "limit reached" toast or `/quota` endpoint of your own
- [ ] Usage counted once: by the backend handler, or by `bridge.usage` only for browser-only actions
- [ ] Plan features: on the plan (`bridge plan feature add`) and gated by a flag ruled `bridge:billing.entitlement.<key> eq true` — `<FeatureFlag>` or a `useFlag` guard, never a check of the plan in the page
- [ ] `npx @nebulr-group/bridge-cli check gates` reports nothing
- [ ] No extra packages installed (`@stripe/stripe-js` must NOT be in package.json)

## Verify

1. Open `/subscription` — plan cards render cheapest first; a tier with monthly + yearly pricing shows interval tabs.
2. Select a free plan: the plan changes and you land on `/subscription` with a "You're on … now" banner.
3. Select a paid plan — Stripe Checkout launches.
4. Complete payment: you land on `/subscription` with the new plan showing and a "You're on … now" banner.
5. Cancel payment — you are back on the page you picked from.
6. Paywall: sign in as a new workspace with no plan — you are sent to `/subscription/plan` before the app renders.
7. With a backend `@RequireQuota`: hit the cap — the upgrade dialog names the metric.
8. Run the project's build command — no TypeScript or import errors.

---

> **If you are running this guide as part of `bridge guide billing` (the master prompt):** this guide is now complete. Return to the master and continue with the remaining steps (paywall, verification, success banner, follow-on tracks). Do not stop here.

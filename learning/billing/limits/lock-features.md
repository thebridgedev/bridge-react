# Lock features to a plan

This is where Bridge billing pays off in your UI: gate a premium feature on the plan, and the moment a workspace (called a *tenant* in the API) upgrades, the feature **unlocks live**. No reload, no re-login, no polling. Plans grant **entitlements**, named capabilities like `ai_completions` or `sso`, that arrive with the session snapshot and are replaced wholesale on every `entitlements.changed` push. Because it's the same live channel (a persistent realtime connection the SDK maintains) that drives the rest of the `bridge` object, any open tab with a live connection stays in sync.

## What's an entitlement, and how is it different from a feature flag?

If you already use [feature flags](/feature-flags/), this is the first question you'll ask, because both gate features. The short answer: they work at different layers and are best used **together**.

An **entitlement** is *billing truth*: "does this workspace's **plan** grant capability X?" Bridge computes it from the subscription. It's a piece of live **data**, not a targeting engine. You don't configure who gets it or roll it out gradually; it's simply whatever the plan says, and it changes only when the plan changes.

A **feature flag** is *your control surface*: a switch you own in Control Center (your admin dashboard at app.thebridge.dev) with arbitrary targeting (percentage, role, cohort, kill switch), independent of billing. It's a decision **engine**.

| | Entitlement | Feature flag |
|---|---|---|
| What it is | **Data**: "what did they pay for?" | **Engine**: "what do I switch on, for whom, now?" |
| Who sets it | Billing (the plan definition) | You, in Control Center |
| Configurable per-user / rollout? | No, it's whatever the plan grants | Yes: %, role, cohort, kill switch |
| Changes when | The subscription changes | You change the rule |
| Answers | **Eligibility** | **Exposure** |

One line to remember: **an entitlement is what they bought; a feature flag is what you choose to switch on.** They aren't competitors. An entitlement is a clean, billing-maintained *signal*, and a flag is an engine that can *read* that signal. That's the recommended pattern.

## The standard pattern: a flag targeting the entitlement

Put the feature in the plan's features list (`bridge plan feature add pro analytics --name "Analytics"`), then gate it on a **feature flag** whose rule is `bridge:billing.entitlement.analytics eq true`, rather than checking the entitlement directly:

```tsx
import { FeatureFlag } from '@nebulr-group/bridge-react';

<FeatureFlag flagKey="analytics" defaultValue={false} upgrade>
  <a href="/analytics">Analytics</a>
</FeatureFlag>
```

With `upgrade`, a workspace whose plan does not include the feature sees an **"Upgrade to use this"** button in its place; clicking it opens the upgrade dialog `<BridgeProvider>` mounts, which names the plans that include the feature. Off for any other reason (the person's role, a rollout), nothing renders. Nothing opens by itself: a page that only renders a hidden feature opens no dialog.

For your own prompt, use the fallback render prop; it learns why the feature is off and gets `openUpgrade`:

```tsx
<FeatureFlag
  flagKey="analytics"
  defaultValue={false}
  fallback={(_value, { reason, openUpgrade }) =>
    reason === 'plan' ? <button onClick={openUpgrade}>Unlock analytics</button> : null
  }
>
  <AnalyticsPanel />
</FeatureFlag>
```

In logic, `useFlag('analytics', false)` from `@nebulr-group/bridge-react/flags` returns the same `value`, `reason` and `feature`. A backend endpoint behind the same flag (bridge-nestjs `@RequireFeatureFlag('analytics')`) answers `402 FEATURE_NOT_IN_PLAN` to a workspace without it, and a request made with `bridgeFetch` opens the same dialog.

You get the best of both: the **entitlement** supplies plan eligibility (and stays correct across plan renames or a bespoke grant to one enterprise customer), while the **flag** adds everything flags give you *on top*: percentage rollouts within a plan, an instant kill switch, per-segment overrides, all without a code change. See the [Feature Flags → Target by plan or role](/feature-flags/targeting/by-plan-or-role/) guide for the full list of `bridge:billing.*` targeting attributes (plan, subscription status, quotas, entitlements).

## Using entitlements standalone (the exception)

Checking the plan directly, without a flag, is for the rare case where you explicitly want no flag. It works and stays supported; in development it prints a one-time note naming the standard. Mark the line `// bridge-gate-exception: <reason>` so `bridge check gates` leaves it.

```tsx
import { Entitled, useEntitlements } from '@nebulr-group/bridge-react';

// markup
<Entitled to="analytics" fallback={<a href="/subscription">Upgrade for analytics</a>} loading={<Spinner />}>
  <AnalyticsPanel />
</Entitled>

// logic
function AiSection() {
  const entitlements = useEntitlements();
  if (!entitlements.ready) return null;          // not answered yet ≠ "not allowed"
  return entitlements.can('ai_completions') ? <AiPanel /> : null;
}
```

`<Entitled>` renders neither the feature nor the fallback until Bridge has answered, so a cold start never flashes the upgrade prompt at a paying workspace. `useEntitlements()` returns `{ ready, can(key), all }`; `can` is fail-closed (`false` until answered, and for a key the plan does not grant), and `ready` tells those two apart. Signing out empties it.

Either way it's live: when the workspace upgrades, `entitlements.changed` replaces the snapshot and your gate re-evaluates on its own.

> Entitlements are **billing-derived** (what the plan grants the workspace). They are not roles: use Bridge's role/privilege system for who-may-do-what inside a workspace.

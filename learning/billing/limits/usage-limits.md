# Show usage limits in your app

Where an [entitlement](/billing/limits/lock-features/) is a yes/no switch, a **quota** is a metered allowance that a workspace (called a *tenant* in the API) can run down and hit: 10,000 AI calls a month, 20 seats. Quotas are **defined on the plan**; see [Define your plans](/billing/setup/define-plans/) for setting them. This page covers showing quota state in your app and reacting as usage climbs. To submit the usage that fills these quotas, see [Report usage](/billing/limits/report-usage/).

`<BridgeQuotaBanner>` warns users as they approach a metric's cap so a hard stop never comes as a surprise, and it nudges them to upgrade. It's a live usage-cap banner for one metric: it renders nothing while usage is below 80% of the plan's quota (or when the plan has no quota for that metric), shows a warning at 80–94%, critical at 95%+, and over-cap copy when the limit is exceeded. It updates live on `quota.updated` pushes.

```tsx
import { BridgeQuotaBanner } from '@nebulr-group/bridge-react';

<BridgeQuotaBanner metric="ai_completions" />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `metric` | `string` | required | Metric key to watch |
| `label` | `string` | metric key | Humanized display label |
| `className` | `string` | `''` | Class applied to the root element |
| `onActionClick` | `(snap) => void` | (none) | Override the default Upgrade CTA handler |
| `actionHref` | `string` | — | Upgrade CTA destination for this instance; falls back to `billing.manageRoute` config (default `/subscription`) |

## Three ways to handle a limit

Pick the lowest level that does the job. Each is optional; level 0 is on without code. The rules behind them (where a limit is counted, counter or gauge) are in [How Bridge works](../../mechanisms.md).

| Level | What the page writes | What the user sees |
|---|---|---|
| **0 — nothing** | a button calling your API with `bridgeFetch()` | Your backend refuses at the cap (`402 QUOTA_EXCEEDED`, e.g. from bridge-nestjs `@RequireQuota`), and `<BridgeProvider>` opens an **upgrade dialog** naming the metric and linking to the subscription page. A member who cannot manage billing is told to ask the workspace owner |
| **1 — one component** | `<QuotaGate metric="tickets">` around the button | The button is disabled at a known hard cap, with an upgrade line beside it |
| **2 — your own UI** | `useQuota('tickets')` | Whatever you build from the live numbers |

Do not write a quota `if`, a "limit reached" toast or a `/quota` endpoint of your own: level 0 already covers the refusal, and the frontend reads quota directly from Bridge.

### Level 0: the upgrade dialog

```tsx
import { bridgeFetch } from '@nebulr-group/bridge-react';

<button onClick={() => bridgeFetch('/api/tickets', { method: 'POST' })}>New ticket</button>
```

`bridgeFetch` is `fetch` with the signed-in user's token (and one token refresh on a `401`). It returns the response unchanged; the dialog is decoration, and the backend's refusal is what stops the write. The dialog also opens for a `402` from a plain `fetch` to the page's own origin or Bridge's API; a backend on another origin called with plain `fetch` goes in `billing.apiOrigins`.

- `billing: { upgradeDialog: false }` turns the dialog off; listen with `onBridgeQuotaExceeded((refusal) => …)` instead.
- `billing: { upgradeDialog: MyDialog }` replaces it. `MyDialog` receives `{ refusal, upgradeHref, canUpgrade, onClose, feature, plans }`.
- The Upgrade button goes to the refusal's `fix` path when the backend sent one, else `billing.manageRoute` (default `/subscription`).

### Level 1: `<QuotaGate>`

```tsx
import { QuotaGate } from '@nebulr-group/bridge-react';

<QuotaGate metric="tickets">
  <button onClick={createTicket}>New ticket</button>
</QuotaGate>

<QuotaGate metric="tickets" atLimit={(q) => <>{q.used} of {q.limit} tickets used. <a href="/subscription">Upgrade</a></>}>
  <button onClick={createTicket}>New ticket</button>
</QuotaGate>
```

It disables every button, input, select and textarea inside (a `<fieldset disabled>` around them) once the workspace is at its plan's hard cap, and shows "You've used all N tickets on your plan. Upgrade" beside them; `atLimit` replaces that line. It never disables on "don't know yet": while loading, when the plan has no quota on the metric, or when the quota is metered (it bills overage instead of blocking), the children stay enabled. The wrapper carries `data-state` (`loading`, `unlimited`, `metered`, `available`, `at-limit`).

### Level 2: `useQuota`

```tsx
import { useQuota } from '@nebulr-group/bridge-react';

function TicketCount() {
  const tickets = useQuota('tickets');
  if (tickets.loading) return <>Loading…</>;
  if (tickets.unlimited) return <>Unlimited tickets</>;
  return <>{tickets.used} of {tickets.limit} tickets</>;
}
```

| Field | Meaning |
|-------|---------|
| `loading` | `true` until Bridge has answered. The numbers are `null` meanwhile — never `0` |
| `unlimited` | `true` once Bridge has answered that the plan puts no quota on this metric |
| `used` / `limit` / `remaining` | The live numbers, `null` while loading or unlimited |
| `warningLevel` | `'approaching'` from 80%, `'critical'` from 95%, else `null` |
| `kind` | `'counter'` (resets each period) or `'gauge'` (how many exist now) |
| `snapshot` | The full snapshot (policy, overage fields), or `null` |

The numbers move on their own when usage changes (every `quota.updated` push).

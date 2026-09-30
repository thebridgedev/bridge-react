# Report usage

A quota counts what a workspace (called a *tenant* in the API) uses: AI calls, exports, projects. **Count usage once, where the action happens.** Ask one question: does the click call your server?

- **Yes** — the backend handler that does the work counts it (bridge-nestjs `@RequireQuota` / `@SyncQuota`). The page only shows the number and the upgrade dialog; it reports nothing, and this page does not apply.
- **No** — the action happens in the browser (a local-first app, data on the device), so the browser counts it with `bridge.usage`. That is a complete, first-class setup; put `<QuotaGate>` around the button so it stops at the limit.

Never both: counting the same action on each side counts it twice. In development the plugin warns once in the console when your backend and the page count the same metric. This page covers reporting; to define the quota on the plan see [Define your plans](/billing/setup/define-plans/), and to show a workspace how close it is to a cap see [Show usage limits](/billing/limits/usage-limits/).

## Counter or gauge

**If deleting it frees room, it's a gauge and your app counts it; if it happened, it's a counter and Bridge counts it.**

```ts
import { bridge } from '@nebulr-group/bridge-react';

bridge.usage.report('exports');                        // a counter: it happened (value defaults to 1)
bridge.usage.report('tokens', 1375);                   // N units at once
await bridge.usage.set('projects', projects.length);   // a gauge: how many exist now
```

`report` is fire-and-forget: it returns immediately and never throws into your code path, so you can drop it straight into a handler. `set` is absolute, never added up, and resolves once Bridge has stored the value; call it after the app creates or deletes one.

The `metric` string must match the metric key of a quota on the plan (the `--metric` you passed to `bridge plan quota set`). Reporting a metric with no matching quota is harmless; it is simply counted and available for later.

## What happens to a reported event

You do not have to manage batching, retries, or network failures. The reporter handles all of it:

- **Batched:** events are buffered and flushed together (by default 10 events or every second), so reporting on a hot path stays cheap.
- **Durable:** each accepted event is persisted locally (IndexedDB in the browser) before it is sent, so a page navigation, reload, or crash cannot lose it. On the next load the reporter replays anything unsent.
- **Idempotent:** every event carries an idempotency key (generated for you when you omit it) that survives those replays, so the server counts each event once even if it is sent twice.
- **Per workspace:** usage is billed to the signed-in user's workspace, which the server derives from the access token. Events reported without a signed-in user are dropped rather than mis-attributed, so report usage only from authenticated parts of your app.

Because of the idempotency key, you can pass your own when a single logical action might fire `report` more than once (a component re-render, a retried request) and want the server to dedupe them:

```ts
bridge.usage.report('report_generated', 1, `report:${reportId}`);
```

## Check the queue while developing

To confirm events are flowing, or to surface reporter health in an internal dashboard, read the queue status:

```ts
const status = await bridge.usage.getQueueStatus();
// { queueDepth, retryCount, lastFlushTimestamp, lastFlushError }
```

`queueDepth` is how many events are waiting, `lastFlushError` is the last send error (or `null` when the last flush was clean). This is for observability only; you never need it to make reporting work.

> Reporting from the browser records usage; it does not block the action. To stop at the limit, put `<QuotaGate metric>` around the button (see [Show usage limits](/billing/limits/usage-limits/)). When a backend does the work, its `@RequireQuota` refuses at the cap and the page shows the upgrade dialog with no code.

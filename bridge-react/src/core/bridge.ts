/**
 * Live Channel Unification (TBP-288/319) — unified read surface for bridge-nextjs.
 *
 * Ported from bridge-svelte's `core/bridge.ts`. Single object grouped by scope
 * (`bridge.app` / `bridge.tenant` / `bridge.user`). Each snapshot slice is a
 * Svelte-store-compatible readable populated from `session.snapshot` on channel
 * connect AND on every reconnect; lazy slices (`app.plans`) populate on first
 * `.load()` / `await`.
 *
 * Reactive primitive translation (§5.1): svelte `derived(...)` stores become
 * thin Svelte-store-compatible readables backed by the Zustand snapshot store
 * (`snapshot-stores.ts`). The `.subscribe(fn)` contract is preserved (immediate
 * call + on every change, returns unsubscribe) so the unified-surface Playwright
 * spec ports verbatim. React consumers read the same state via `useBridge()` and
 * the underlying Zustand hooks.
 *
 * The singleton `bridge` is available immediately on import — every slice is
 * `null` until the realtime client receives a `session.snapshot`, at which point
 * each slice updates atomically. Identity is stable: the object reference never
 * changes, so consumers can destructure or store sub-references freely.
 */
import {
  useSnapshotStore,
  type BrandingSnapshot,
  type SubscriptionSnapshot,
  type UserSnapshot,
} from './snapshot-stores';
import { LazySlice } from './lazy-slice';
import type { BridgeAuth, Plan } from '@nebulr-group/bridge-auth-core';
import { DevAttributeProvider } from '@nebulr-group/bridge-auth-core';
import { getBridgeAuth } from './bridge-instance';
import { bridgeEvents, type BridgeEventsDispatcher } from './events';
import { noteBrowserCount } from './double-count-warning';

/** Svelte-store-compatible readable derived from a Zustand selector. */
export interface BridgeReadable<T> {
  subscribe(run: (value: T) => void): () => void;
}

function makeReadable<T>(select: (s: ReturnType<typeof useSnapshotStore.getState>) => T): BridgeReadable<T> {
  return {
    subscribe(run: (value: T) => void): () => void {
      run(select(useSnapshotStore.getState()));
      let prev = select(useSnapshotStore.getState());
      return useSnapshotStore.subscribe((s) => {
        const next = select(s);
        if (next !== prev) {
          prev = next;
          run(next);
        }
      });
    },
  };
}

export interface BridgeAppSurface {
  /** Whitelabel branding (logo, colors, name). Populated by session.snapshot. */
  branding: BridgeReadable<BrandingSnapshot | null>;
  /**
   * Full plan catalog. Lazy — `await bridge.app.plans` or `bridge.app.plans.load()`
   * triggers the fetch on first access. Returns `null` until loaded.
   */
  plans: LazySlice<Plan[]>;
}

export interface BridgeTenantSurface {
  /** Workspace identifier. Populated by session.snapshot. */
  id: BridgeReadable<string | null>;
  /** Workspace display name. Populated by session.snapshot. */
  name: BridgeReadable<string | null>;
  /**
   * Canonical subscription (plan + status + endsAt). Populated by session.snapshot
   * and moved by every `subscription.plan_changed` push.
   */
  subscription: BridgeReadable<SubscriptionSnapshot | null>;
  /**
   * Entitlements scope. `snapshot` is the full `{ key: boolean }` map; `can(key)`
   * is the imperative read for ergonomic checks. The map is populated by
   * `session.snapshot` and replaced wholesale on every `entitlements.changed`
   * push.
   */
  entitlements: {
    snapshot: BridgeReadable<Record<string, boolean> | null>;
    can(key: string): boolean;
  };
}

/**
 * TBP-743 (port of bridge-svelte TBP-697) — usage reporting from the browser.
 *
 * Count once, where the action happens. When the action stays in the browser
 * (a local-first app, data on the device) count it here — a first-class setup:
 * Bridge shows and bills what the page reports, and `<QuotaGate>` stops the
 * button at the limit. When the click calls your server, the backend handler
 * counts it (bridge-nestjs `@RequireQuota`) and the page reports nothing. In
 * development the console warns once when a metric is counted on both sides.
 *
 * Which call: *if deleting it frees room, it's a gauge and your app counts it
 * (`set`); if it happened, it's a counter and Bridge counts it (`report`).*
 */
export interface BridgeUsageSurface {
  /**
   * Count something that happened (a counter): `report('ai_completions')`,
   * `report('tokens', 1375)`. Fire-and-forget; queued durably and sent in
   * batches. Pass an `idempotencyKey` when the same event could be reported
   * twice (a retry), so Bridge counts it once.
   */
  report(metric: string, value?: number, idempotencyKey?: string): void;
  /**
   * Say how many of something exist right now (a gauge): `set('projects', 8)`
   * after the app creates or deletes one. Absolute, never added up; resolves
   * once Bridge has stored it.
   */
  set(metric: string, value: number): Promise<void>;
  /** Queue depth, retries and the last flush — for a debug panel. */
  getQueueStatus(): Promise<UsageQueueStatus>;
}

/** What `bridge.usage.getQueueStatus()` resolves to. */
export type UsageQueueStatus = Awaited<ReturnType<BridgeAuth['usage']['getQueueStatus']>>;

export interface BridgeSurface {
  app: BridgeAppSurface;
  tenant: BridgeTenantSurface;
  /** Authenticated user (id/email/role/tenantId). Populated by session.snapshot. */
  user: BridgeReadable<UserSnapshot | null>;
  /**
   * Single attribute write surface. `set/bind/bindMany` publish dev-supplied
   * attributes into the flag eval context. `get()` returns the current merged
   * map.
   */
  attributes: DevAttributeProvider;
  /**
   * Single events dispatcher. `bridge.events.handle({...})` is the canonical way
   * to subscribe to channel events.
   */
  events: BridgeEventsDispatcher;
  /**
   * Report usage from the browser: `bridge.usage.report(metric)` for a
   * counter, `bridge.usage.set(metric, value)` for a gauge. See
   * {@link BridgeUsageSurface}.
   */
  usage: BridgeUsageSurface;
}

function entitlementsCan(key: string): boolean {
  return !!useSnapshotStore.getState().tenantEntitlements?.[key];
}

// Lazy slice loaders — deferred to first .load() / await. Wrapped in arrow
// functions so getBridgeAuth() resolution happens at load time, not at module
// import (otherwise SSR import of the bridge surface throws because initBridge()
// hasn't been called yet).
const _plansSlice = new LazySlice<Plan[]>({
  load: async () => getBridgeAuth().getPlans(),
});

// Singleton dev-attribute provider. The flags wiring registers this instance
// with the flag eval registry at bootstrap (LAST in registration order so dev
// keys win on collision).
const _devAttributes = new DevAttributeProvider();

// Resolved on each call, not at import: the BridgeAuth instance does not exist
// until <BridgeProvider> has rendered.
const _usage: BridgeUsageSurface = {
  report(metric, value, idempotencyKey) {
    noteBrowserCount(metric);
    getBridgeAuth().usage.report(metric, value, idempotencyKey);
  },
  async set(metric, value) {
    noteBrowserCount(metric);
    await getBridgeAuth().usage.set(metric, value);
  },
  getQueueStatus() {
    return getBridgeAuth().usage.getQueueStatus();
  },
};

export const bridge: BridgeSurface = {
  app: {
    branding: makeReadable((s) => s.appBranding),
    plans: _plansSlice,
  },
  tenant: {
    id: makeReadable((s) => s.tenantId),
    name: makeReadable((s) => s.tenantName),
    subscription: makeReadable((s) => s.tenantSubscription),
    entitlements: {
      snapshot: makeReadable((s) => s.tenantEntitlements),
      can: entitlementsCan,
    },
  },
  user: makeReadable((s) => s.user),
  attributes: _devAttributes,
  events: bridgeEvents,
  usage: _usage,
};

/** Internal: the flags wiring imports this to register the dev provider. */
export function _getDevAttributeProvider(): DevAttributeProvider {
  return _devAttributes;
}

/**
 * Test-only: reset every lazy slice on the bridge to its unloaded state.
 * @internal
 */
export function __resetBridgeLazySlices(): void {
  _plansSlice._resetForTests();
}

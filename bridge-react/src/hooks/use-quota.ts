/**
 * TBP-743 (port of bridge-svelte TBP-697) — `useQuota(metric)`: one quota's
 * numbers for your own UI (level 2), from the React plugin alone.
 *
 *   const projects = useQuota('projects');
 *   if (projects.loading) return <Spinner />;
 *   if (projects.unlimited) return <>Unlimited projects</>;
 *   return <>{projects.used} of {projects.limit} projects</>;
 *
 * Reads the same live quota cache `<BridgeQuotaBanner>` does (auth-core's
 * `QuotaStore`: one `GET /usage/quota/:metric` on first read, then every
 * `quota.updated` push), so the numbers move on their own when usage changes.
 *
 * The one rule it exists to keep: **no number until there is a real one.**
 * While the first answer is in flight `loading` is true and `used`, `limit` and
 * `remaining` are `null` — never `0`, which would render "0 of 0" or, worse,
 * "0 used" on a workspace that is actually at its cap.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useBridge as useBillingBridge, type QuotaSnapshot } from '@nebulr-group/bridge-auth-core';
import { useBridgeStore } from '../core/bridge-instance';

type QuotaStore = ReturnType<typeof useBillingBridge>['quotas'];

export interface QuotaState {
  /** True until Bridge has answered for this metric. Numbers are `null` meanwhile. */
  readonly loading: boolean;
  /** True once Bridge has answered that the plan puts no quota on this metric. */
  readonly unlimited: boolean;
  /** How much is used (a counter: this period's total; a gauge: how many exist now). */
  readonly used: number | null;
  /** The plan's cap. `null` while loading or unlimited. */
  readonly limit: number | null;
  /** What is left before the cap, as Bridge computed it. */
  readonly remaining: number | null;
  /** `'approaching'` from 80%, `'critical'` from 95%. */
  readonly warningLevel: 'approaching' | 'critical' | null;
  /** `'counter'` resets each period; `'gauge'` is how many exist now. */
  readonly kind: 'counter' | 'gauge' | null;
  /** The full snapshot (policy, overage fields, …), or `null` while loading or unlimited. */
  readonly snapshot: QuotaSnapshot | null;
}

// The QuotaStore answers "no quota on this plan" by DELETING the metric and
// notifying `undefined` — it keeps no record of the answer, and its
// `ensureHydrated()` refetches any metric it has no snapshot for. So the
// "Bridge said unlimited" answers are remembered here, once per store, and a
// remembered metric is not refetched until the workspace changes.
interface Tracking {
  unlimited: Set<string>;
  workspace: string | null | undefined;
}
const _tracking = new WeakMap<QuotaStore, Tracking>();

function tracking(store: QuotaStore): Tracking {
  let t = _tracking.get(store);
  if (!t) {
    const tr: Tracking = { unlimited: new Set(), workspace: undefined };
    _tracking.set(store, tr);
    store.subscribe((metric, snap) => {
      if (snap) tr.unlimited.delete(metric);
      else tr.unlimited.add(metric);
    });
    t = tr;
  }
  return t;
}

/** `tid` from an access token, or null. Only used to notice a workspace switch. */
function workspaceOf(accessToken: string | null | undefined): string | null {
  if (!accessToken) return null;
  try {
    const part = accessToken.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const tid = (JSON.parse(json) as { tid?: unknown }).tid;
    return typeof tid === 'string' ? tid : null;
  } catch {
    return null;
  }
}

function noteWorkspace(t: Tracking, accessToken: string | null | undefined): void {
  const ws = workspaceOf(accessToken);
  // A different workspace (or signing in/out) is a different plan: an earlier
  // "unlimited" answer no longer holds.
  if (t.workspace !== undefined && ws !== t.workspace) t.unlimited.clear();
  t.workspace = ws;
}

const EMPTY_LOADING: QuotaState = Object.freeze({
  loading: true,
  unlimited: false,
  used: null,
  limit: null,
  remaining: null,
  warningLevel: null,
  kind: null,
  snapshot: null,
});

const UNLIMITED: QuotaState = Object.freeze({
  loading: false,
  unlimited: true,
  used: null,
  limit: null,
  remaining: null,
  warningLevel: null,
  kind: null,
  snapshot: null,
});

// One state object per snapshot object, so `useSyncExternalStore` sees a
// stable value until the store actually changes.
const _states = new WeakMap<QuotaSnapshot, QuotaState>();

function stateOf(snap: QuotaSnapshot): QuotaState {
  let s = _states.get(snap);
  if (!s) {
    s = Object.freeze({
      loading: false,
      unlimited: false,
      used: snap.used,
      limit: snap.limit,
      remaining: snap.remaining,
      warningLevel: snap.warningLevel ?? null,
      // Servers that predate gauges send no kind: those quotas are counters.
      kind: snap.kind === 'gauge' ? 'gauge' : 'counter',
      snapshot: snap,
    });
    _states.set(snap, s);
  }
  return s;
}

function quotaStore(): QuotaStore | null {
  try {
    return useBillingBridge().quotas;
  } catch {
    return null;
  }
}

/** The current state for `metric`, without side effects. */
export function readQuotaState(metric: string): QuotaState {
  const store = quotaStore();
  if (!store) return EMPTY_LOADING;
  const snap = store.get(metric);
  if (snap) return stateOf(snap);
  if (tracking(store).unlimited.has(metric)) return UNLIMITED;
  return EMPTY_LOADING;
}

/**
 * Live numbers for one quota metric.
 *
 * @param metric The metric key (`'projects'`, `'ai_completions'`, `'seats'`).
 */
export function useQuota(metric: string): QuotaState {
  const accessToken = useBridgeStore((s) => s.tokens?.accessToken ?? null);
  const store = quotaStore();
  if (store) noteWorkspace(tracking(store), accessToken);

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!store) return () => {};
      const t = tracking(store);
      return store.subscribe((m, snap) => {
        // Also recorded here, not only by the store-wide tracker: a store
        // reset drops that listener, and this one is re-registered per mount.
        if (snap) t.unlimited.delete(m);
        else t.unlimited.add(m);
        if (m === metric) onChange();
      });
    },
    [store, metric],
  );
  const getSnapshot = useCallback(() => readQuotaState(metric), [metric]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // First read, or the first read after sign-in: ask Bridge. A microtask
  // later, because the runtime configures the store from the same token
  // change, possibly after this effect runs. The store dedupes in-flight
  // requests, and an answered "unlimited" is not asked again.
  useEffect(() => {
    if (!store) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (!store.get(metric) && !tracking(store).unlimited.has(metric)) store.ensureHydrated(metric);
    });
    return () => {
      cancelled = true;
    };
  }, [store, metric, accessToken]);

  return state;
}

/**
 * One metric's quota against the plan, as plain values: the numbers `useQuota` gives, the level a banner shows, and
 * what the page remembers of Bridge's "no limit on this plan" answers. The numbers themselves are auth-core's quota
 * store: one read when first asked for, then again when Bridge says a quota or the plan changed.
 */
import type { Bridge, QuotaSnapshot } from '@nebulr-group/bridge-auth-core';

/** How near a metric is to its limit: `near` from 80%, `over` once the limit is reached. */
export type QuotaLevel = 'ok' | 'near' | 'over';

/** What `useQuota(metric)` gives. */
export interface QuotaState {
	/** True until Bridge has answered for this metric. The numbers are `null` meanwhile, never 0. */
	readonly loading: boolean;
	/** True once Bridge has answered that the plan puts no limit on the metric. */
	readonly unlimited: boolean;
	/** `counter`: this period's total. `gauge`: how many exist now. `null` while loading or unlimited. */
	readonly used: number | null;
	/** The plan's limit. `null` while loading or unlimited. */
	readonly limit: number | null;
	/** What is left before the limit. `null` while loading or unlimited. */
	readonly remaining: number | null;
	/** `approaching` from 80%, `critical` from 95%; `null` below that, while loading or unlimited. */
	readonly warningLevel: 'approaching' | 'critical' | null;
	/** `counter` counts up from your server's usage reports and resets each period; `gauge` is the level your server sets. */
	readonly kind: 'counter' | 'gauge' | null;
	/** The whole snapshot (policy, overage), or `null` while loading or unlimited. */
	readonly snapshot: QuotaSnapshot | null;
	/** `used / limit`; 1 for a limit of 0. `null` while loading or unlimited. */
	readonly ratio: number | null;
	/** `near` from 80% of the limit, `over` once it is reached. `null` while loading or unlimited. */
	readonly state: QuotaLevel | null;
}

/** From this share of the limit, a metric is `near` it. */
export const NEAR_LIMIT = 0.8;
const CRITICAL = 0.95;

/**
 * How near a hard limit a snapshot is: the server's level, or from the numbers when it sent none. The same 80% and 95%
 * the server uses.
 */
export function warningOf(snapshot: QuotaSnapshot): 'approaching' | 'critical' | null {
	if (snapshot.warningLevel !== null) return snapshot.warningLevel;
	if (snapshot.limit <= 0) return null;
	const ratio = snapshot.used / snapshot.limit;
	return ratio >= CRITICAL ? 'critical' : ratio >= NEAR_LIMIT ? 'approaching' : null;
}

const LOADING: QuotaState = Object.freeze({ loading: true, unlimited: false, used: null, limit: null, remaining: null, warningLevel: null, kind: null, snapshot: null, ratio: null, state: null });
const UNLIMITED: QuotaState = Object.freeze({ ...LOADING, loading: false, unlimited: true });

// One state object per snapshot object, so a reader sees the same value until the store changes it.
const states = new WeakMap<QuotaSnapshot, QuotaState>();

function stateOf(snapshot: QuotaSnapshot): QuotaState {
	let state = states.get(snapshot);
	if (state === undefined) {
		const { used, limit } = snapshot;
		const ratio = limit > 0 ? used / limit : 1;
		state = Object.freeze({
			loading: false,
			unlimited: false,
			used,
			limit,
			remaining: snapshot.remaining,
			warningLevel: warningOf(snapshot),
			kind: snapshot.kind === 'gauge' ? 'gauge' : 'counter',
			snapshot,
			ratio,
			state: used >= limit ? 'over' : ratio >= NEAR_LIMIT ? 'near' : 'ok',
		} as const) as QuotaState;
		states.set(snapshot, state);
	}
	return state;
}

// The quota store answers "no limit on this plan" by deleting the metric and telling `undefined`, and keeps no record
// of it: a reader that read again on that would ask again for as long as the page is open. The answers are remembered
// here, once per client, and a remembered metric is not asked for again until the person or workspace changes.
interface Tracking {
	readonly unlimited: Set<string>;
	who: string | null | undefined;
}
const tracked = new WeakMap<Bridge, Tracking>();

export function trackingOf(client: Bridge): Tracking {
	let t = tracked.get(client);
	if (t === undefined) {
		const made: Tracking = { unlimited: new Set(), who: undefined };
		t = made;
		tracked.set(client, made);
		client.quotas.subscribe((metric, snapshot) => {
			if (snapshot === undefined) made.unlimited.add(metric);
			else made.unlimited.delete(metric);
		});
	}
	return t;
}

/** Tells the tracking who is signed in (null: nobody). Another person or workspace has another plan: what was "unlimited" no longer holds. */
export function noteSession(client: Bridge, who: string | null): void {
	const t = trackingOf(client);
	if (t.who !== undefined && who !== t.who) t.unlimited.clear();
	t.who = who;
}

/** What the page knows of a metric now, with no side effects. */
export function readQuotaState(client: Bridge, metric: string): QuotaState {
	const snapshot = client.quotas.get(metric);
	if (snapshot !== undefined) return stateOf(snapshot);
	return trackingOf(client).unlimited.has(metric) ? UNLIMITED : LOADING;
}

/** Starts the read of a metric, unless it is held or Bridge already answered that it has no limit. The store dedupes one in flight. */
export function askForQuota(client: Bridge, metric: string): void {
	if (client.quotas.get(metric) === undefined && !trackingOf(client).unlimited.has(metric)) client.quota(metric);
}

export const LOADING_QUOTA = LOADING;

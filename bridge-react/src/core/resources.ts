/**
 * What lives in Bridge (`workspaces`, `me`, `billing`, `plans`, `usage`) as
 * resources: fetched when first watched, again when the person or workspace
 * changes, and again within a second of a Live notice that it changed. The
 * hooks (`useWorkspaces()`, `useBilling()`, …) read these.
 *
 * Who is signed in and the flag results come straight from the client's own
 * stores; see the hooks in `react/hooks.ts`.
 */
import type { Bridge, BillingFacts, LiveNotice, Me, MyWorkspace, Plan, UsageNumbers } from '@nebulr-group/bridge-auth-core';
import { MANY_CHANGED } from '@nebulr-group/bridge-auth-core';
import { bridgeClient } from './client.js';
import { Value, type Watchable } from './value.js';

/** A value fetched from Bridge, with how the fetch is going. */
export interface Resource<T> {
	readonly value: T | null;
	readonly loading: boolean;
	readonly error: unknown;
}

export interface ResourceStore<T> extends Watchable<Resource<T>> {
	/** Fetches it again now. */
	refresh(): Promise<void>;
}

const EMPTY: Resource<never> = { value: null, loading: false, error: null };

/**
 * A value fetched for the signed-in person and workspace, fetched again when
 * either changes and when a Live notice of one of `notices` arrives (a type,
 * or a prefix ending in `.`). It follows the client only while watched.
 */
export function resource<T>(load: (client: Bridge) => Promise<T>, notices: readonly string[]): ResourceStore<T> {
	const state = new Value<Resource<T>>(EMPTY);
	let watchers = 0;
	let client: Bridge | null = null;
	let key: string | null = null;
	let generation = 0;
	let stopFollowing: (() => void) | null = null;

	async function fetchNow(): Promise<void> {
		if (client === null || key === null) return;
		const mine = ++generation;
		const using = client;
		state.update((s) => ({ ...s, loading: true, error: null }));
		try {
			const value = await load(using);
			if (mine === generation) state.set({ value, loading: false, error: null });
		} catch (error) {
			if (mine === generation) state.update((s) => ({ ...s, loading: false, error }));
		}
	}

	const matches = (notice: LiveNotice) => notices.some((n) => (n.endsWith('.') ? notice.type.startsWith(n) : notice.type === n));

	function follow(current: Bridge | null): () => void {
		client = current;
		key = null;
		generation++;
		if (current === null) {
			state.set(EMPTY);
			return () => undefined;
		}
		const stopSession = current.session.subscribe((s) => {
			const next = s.status === 'signed-in' ? `${s.user.id}|${s.workspace?.id ?? ''}` : null;
			if (next === key) return;
			key = next;
			generation++;
			state.set(EMPTY);
			if (next !== null) void fetchNow();
		});
		const stopNotices = current.on('notice', (notice) => {
			if (key !== null && (matches(notice) || notice.type === MANY_CHANGED)) void fetchNow();
		});
		return () => {
			stopSession();
			stopNotices();
		};
	}

	function start() {
		let stopClient: () => void = () => undefined;
		const stopWatch = bridgeClient.subscribe((current) => {
			stopClient();
			stopClient = follow(current);
		});
		stopClient = follow(bridgeClient.get());
		stopFollowing = () => {
			stopWatch();
			stopClient();
			client = null;
			key = null;
			generation++;
		};
	}

	return {
		get: () => state.get(),
		subscribe(listener) {
			const stop = state.subscribe(listener);
			watchers += 1;
			if (watchers === 1) start();
			return () => {
				stop();
				watchers -= 1;
				if (watchers === 0) {
					stopFollowing?.();
					stopFollowing = null;
					state.set(EMPTY);
				}
			};
		},
		refresh: fetchNow,
	};
}

/** The person's workspaces, with names and logos, for a chooser. */
export const workspaces: ResourceStore<readonly MyWorkspace[]> = resource((client) => client.workspaces.list(), ['accounts.']);

/** The signed-in person's profile. */
export const me: ResourceStore<Me> = resource((client) => client.me.get(), ['accounts.']);

/** The workspace's billing facts: plan, status, trial, limits and usage. For showing, never for gating. */
export const billing: ResourceStore<BillingFacts> = resource((client) => client.billing.state(), ['billing.']);

/** The plans on offer. */
export const plans: ResourceStore<readonly Plan[]> = resource((client) => client.billing.plans(), ['billing.']);

/** This period's usage of each metric, with its limit. */
export const usage: ResourceStore<UsageNumbers> = resource((client) => client.billing.usage(), ['billing.']);

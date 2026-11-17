/**
 * `useBridgeBilling()`: the 0.9 name for the billing handle. It is not a React hook: it reads nothing during render, so
 * call it anywhere (a component, an event handler, a module). It always answers, and it follows the page's client: before
 * `<BridgeProvider>` has made one, nothing is locked, no quota is known, no plan feature is on.
 *
 * What it gives is what 0.9 gave for the numbers and the lock: `quota(metric)`, `quotas`, `entitlements`, `handle`,
 * `isLocked()`, `gateState()` and `assertNotLocked()`. In a component, `useQuota`, `useEntitlements` and
 * `useBillingGate` redraw on a change; this handle does not.
 */
import type { BillingEventHandlers, BillingGateState, Bridge, QuotaSnapshot, QuotaStore } from '@nebulr-group/bridge-auth-core';
import { bridgeClient } from '../core/client.js';

const OPEN: BillingGateState = Object.freeze({ locked: false, severity: 'info', noticeState: 'active' });
const NO_FEATURES: Readonly<Record<string, boolean>> = Object.freeze({});

export interface BridgeBillingApi {
	/** The metric's numbers, or `undefined` until Bridge has answered (the read starts at the first call). */
	quota(metric: string): QuotaSnapshot | undefined;
	/** Every metric asked for, with `subscribe` to hear a change. Throws before `<BridgeProvider>` has made the client. */
	readonly quotas: QuotaStore;
	readonly entitlements: {
		/** Whether the plan has the feature: `false` until Bridge has answered. */
		can(key: string): boolean;
		all(): Readonly<Record<string, boolean>>;
	};
	/** Runs `handlers['quota.updated']` when a metric's numbers changed. Returns how to remove the handlers. */
	handle(handlers: BillingEventHandlers): () => void;
	/** True when the workspace is locked for payment; false until that is known. */
	isLocked(): boolean;
	gateState(): BillingGateState;
	/** Throws a `BillingLockedError` when the workspace is locked for payment. */
	assertNotLocked(): void;
}

const api: BridgeBillingApi = {
	quota: (metric) => bridgeClient.get()?.quota(metric),
	get quotas(): QuotaStore {
		const client: Bridge | null = bridgeClient.get();
		if (client === null) throw new Error('useBridgeBilling().quotas needs <BridgeProvider> to have started.');
		return client.quotas;
	},
	entitlements: {
		can: (key) => bridgeClient.get()?.entitlements.can(key) ?? false,
		all: () => bridgeClient.get()?.entitlements.all() ?? NO_FEATURES,
	},
	handle(handlers) {
		// Handlers given before the client exists are attached when it does, and move to a client that replaces it.
		let removeFromClient: (() => void) | null = null;
		let current: Bridge | null = null;
		const attach = (client: Bridge | null) => {
			if (client === current) return;
			removeFromClient?.();
			removeFromClient = client === null ? null : client.handle(handlers);
			current = client;
		};
		attach(bridgeClient.get());
		const stopWatching = bridgeClient.subscribe(attach);
		return () => {
			stopWatching();
			removeFromClient?.();
			removeFromClient = null;
		};
	},
	isLocked: () => bridgeClient.get()?.isLocked() ?? false,
	gateState: () => bridgeClient.get()?.gateState() ?? OPEN,
	assertNotLocked: () => bridgeClient.get()?.assertNotLocked(),
};

/** The billing handle of the page's client (see the file's comment). */
export function useBridgeBilling(): BridgeBillingApi {
	return api;
}

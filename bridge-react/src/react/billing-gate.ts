/**
 * Whether the workspace is locked for payment. The lock is Bridge's: a locked workspace can be read but not changed.
 * It is read when the page starts and again when Bridge says access changed, and a 402 for the lock that your own API
 * answers through `bridgeFetch` shows it at once.
 */
import type { BillingGateState } from '@nebulr-group/bridge-auth-core';
import { useCallback, useSyncExternalStore } from 'react';
import { useBridge } from './hooks.js';

const OPEN: BillingGateState = Object.freeze({ locked: false, severity: 'info', noticeState: 'active' });
const noop = () => undefined;

// `gateState()` builds a new object on each call: the last one is kept while its values are the same.
const last = new WeakMap<object, BillingGateState>();

/** The lock: `{ locked, severity, noticeState, recoveryUrl }`. Not locked until Bridge says so. */
export function useBillingGate(): BillingGateState {
	const client = useBridge();
	const subscribe = useCallback((onChange: () => void) => (client === null ? noop : client.on('gate-changed', onChange)), [client]);
	const read = useCallback((): BillingGateState => {
		if (client === null) return OPEN;
		const now = client.gateState();
		const before = last.get(client);
		if (before !== undefined && before.locked === now.locked && before.severity === now.severity && before.noticeState === now.noticeState && before.recoveryUrl === now.recoveryUrl) return before;
		last.set(client, now);
		return now;
	}, [client]);
	return useSyncExternalStore(subscribe, read, read);
}

/** Whether the workspace is locked for payment. */
export function useBillingLocked(): boolean {
	return useBillingGate().locked;
}

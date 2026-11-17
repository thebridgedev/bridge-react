/**
 * `useEntitlements()`: which plan features the workspace has.
 *
 * ```tsx
 * const entitlements = useEntitlements();
 * if (!entitlements.ready) return <Spinner />;
 * return entitlements.can('analytics') ? <Analytics /> : <UpgradeForAnalytics />;
 * ```
 *
 * A plan feature is the flag `bridge:billing.entitlement.<key>`: `can('analytics')` reads that flag, never the plan, so
 * a rule on the flag (a rollout, a privilege) is honoured. It is fail-closed: `false` until Bridge has answered and for
 * a feature the plan does not have, and `ready` tells those two apart. It moves when the flags do.
 */
import { useMemo } from 'react';
import { useBridge, useFlags, useFlagsStatus } from './hooks.js';

export interface EntitlementsState {
	/** True once Bridge has answered. Before that every `can()` is `false`. */
	readonly ready: boolean;
	/** `true` only when the plan has the feature `key` on. */
	can(key: string): boolean;
	/** Every plan feature Bridge gave a result for, `{ key: on }`. */
	readonly all: Readonly<Record<string, boolean>>;
}

const NOT_READY: EntitlementsState = Object.freeze({ ready: false, all: Object.freeze({}), can: () => false });

/** The workspace's plan features, live. */
export function useEntitlements(): EntitlementsState {
	const client = useBridge();
	const flags = useFlags();
	const status = useFlagsStatus();
	return useMemo((): EntitlementsState => {
		if (client === null || status !== 'ready') return NOT_READY;
		const all = Object.freeze(client.entitlements.all());
		return Object.freeze({ ready: true, all, can: (key: string) => client.entitlements.can(key) });
		// `flags` changes whenever a result does.
	}, [client, flags, status]);
}

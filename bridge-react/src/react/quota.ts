/**
 * One metric's quota against the plan, for your own UI. The numbers are auth-core's quota store: one read when first
 * asked for, then again when Bridge says a quota or the plan changed.
 *
 * ```tsx
 * const projects = useQuota('projects');
 * if (projects.loading) return <Spinner />;
 * if (projects.unlimited) return <>Unlimited projects</>;
 * return <>{projects.used} of {projects.limit} projects</>;
 * ```
 *
 * Numbers only, never a gate: whether something is allowed is a flag, and your server refuses the write.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { LOADING_QUOTA, askForQuota, noteSession, readQuotaState, type QuotaState } from '../core/quota.js';
import { useBridge, useSession } from './hooks.js';

const noop = () => undefined;

/**
 * Live numbers for one metric. `loading` is true until Bridge has answered, and the numbers are `null` meanwhile,
 * never a made-up 0.
 *
 * @param metric The metric's key, such as `projects`.
 */
export function useQuota(metric: string): QuotaState {
	const client = useBridge();
	const session = useSession();
	const who = session.status === 'signed-in' ? `${session.user.id}|${session.workspace?.id ?? ''}` : null;
	// Before the read below: a person or workspace that changed has another plan.
	if (client !== null) noteSession(client, who);

	const subscribe = useCallback(
		(onChange: () => void) => (client === null ? noop : client.quotas.subscribe((m) => (m === metric ? onChange() : undefined))),
		[client, metric],
	);
	const read = useCallback(() => (client === null ? LOADING_QUOTA : readQuotaState(client, metric)), [client, metric]);
	const state = useSyncExternalStore(subscribe, read, read);

	// The first read, and the first after a person signs in: the store cannot read for nobody.
	useEffect(() => {
		if (client !== null) askForQuota(client, metric);
	}, [client, metric, who]);

	return state;
}

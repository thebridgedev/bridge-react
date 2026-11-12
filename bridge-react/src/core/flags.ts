/**
 * Reading flags in your own code, outside a component. Every gate is a flag,
 * and its rule says why (a privilege, a plan feature or a rollout). A flag
 * Bridge gave no result for is off, so gates fail closed. In a component,
 * use `useFlag`.
 */
import { getBridge, getConfig } from './client.js';
import { navigate } from './router.js';

/**
 * Waits for flag results, then tells whether the flag is on. When it is off
 * and `redirectTo` is given, the browser goes there.
 *
 * ```ts
 * if (!(await requireFlag('reports', { redirectTo: '/' }))) return;
 * ```
 */
export async function requireFlag(key: string, options: { redirectTo?: string } = {}): Promise<boolean> {
	const client = getBridge();
	await client.ready.catch(() => undefined);
	if (client.flags.status.get() !== 'ready') await client.flags.load().catch(() => undefined);
	if (client.flags.enabled(key)) return true;
	if (options.redirectTo !== undefined) navigate(options.redirectTo, { replace: true });
	return false;
}

/** Whether the person may manage billing now: the `billingManage` flag. */
export function canManageBilling(): boolean {
	return getBridge().flags.enabled(getConfig().flagKeys.billingManage);
}

/** Whether the person may manage the team now: the `teamManage` flag. */
export function canManageTeam(): boolean {
	return getBridge().flags.enabled(getConfig().flagKeys.teamManage);
}

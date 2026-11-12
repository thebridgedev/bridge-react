/**
 * Hooks over the page's Bridge client. Each one is safe to call before
 * `<BridgeProvider>` has made the client: it gives the empty value, then
 * the real one.
 *
 * Who is signed in (`useSession`, `useUser`, `useWorkspace`) and the flag
 * results come straight from the client. What lives in Bridge
 * (`useWorkspaces`, `useMe`, `useBilling`, `usePlans`, `useUsage`) is a
 * resource: fetched when first shown, again when the person or workspace
 * changes, and again within a second of a Live notice that it changed.
 */
import type {
	Bridge,
	BillingFacts,
	FlagReason,
	FlagResult,
	FlagsStatus,
	LiveStatus,
	Me,
	MyWorkspace,
	Plan,
	SessionState,
	SessionUser,
	UsageNumbers,
} from '@nebulr-group/bridge-auth-core';
import { useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import { bridgeClient, bridgeConfig } from '../core/client.js';
import type { BridgeMessages, ResolvedConfig } from '../core/config.js';
import { translator, type BridgeTranslator } from '../core/i18n.js';
import { billing, me, plans, usage, workspaces, type Resource, type ResourceStore } from '../core/resources.js';
import { browserRouter, navigate as routerNavigate, type BridgeRouter } from '../core/router.js';
import { upgradeRequest, type UpgradeRequest } from '../core/upgrade.js';
import type { Watchable } from '../core/value.js';
import { RouterContext } from './context.js';

const noop = () => undefined;

/** Reads a watchable value, rendering again when it changes. */
export function useWatch<T>(source: Watchable<T>): T {
	return useSyncExternalStore(
		useCallback((listener: () => void) => source.subscribe(listener), [source]),
		() => source.get(),
		() => source.get(),
	);
}

/** Reads one of the client's own stores, or `initial` before there is a client. */
function useFromClient<T>(pick: (client: Bridge) => Watchable<T>, initial: T): T {
	const client = useWatch(bridgeClient);
	const source = useMemo<Watchable<T>>(() => (client === null ? { get: () => initial, subscribe: () => noop } : pick(client)), [client]);
	return useWatch(source);
}

/** The page's Bridge client, or null before `<BridgeProvider>` has made it. */
export function useBridge(): Bridge | null {
	return useWatch(bridgeClient);
}

/** The resolved settings, or null before `<BridgeProvider>`. */
export function useBridgeConfig(): ResolvedConfig | null {
	return useWatch(bridgeConfig);
}

/** The router the package navigates with: the one given to `<BridgeProvider>`, else the browser's. */
export function useBridgeRouter(): BridgeRouter {
	return useContext(RouterContext) ?? { ...browserRouter(), navigate: routerNavigate };
}

const LOADING: SessionState = { status: 'loading' };

/** Who is signed in: `loading`, `signed-out` (with why) or `signed-in` (with the user and workspace). */
export function useSession(): SessionState {
	return useFromClient((client) => client.session, LOADING);
}

/** The signed-in user, or null. */
export function useUser(): SessionUser | null {
	const session = useSession();
	return session.status === 'signed-in' ? session.user : null;
}

/** Whether someone is signed in. */
export function useSignedIn(): boolean {
	return useSession().status === 'signed-in';
}

const NO_FLAGS: ReadonlyMap<string, FlagResult> = new Map();

/** Every flag result Bridge gave for this person (or visitor) and workspace. */
export function useFlags(): ReadonlyMap<string, FlagResult> {
	// The client's flags read `all()` for the results this person and workspace may see.
	return useFromClient<ReadonlyMap<string, FlagResult>>((client) => ({ get: () => client.flags.all(), subscribe: (l) => client.flags.subscribe(l) }), NO_FLAGS);
}

/** Whether flag results have loaded: `idle`, `loading`, `ready` or `error`. */
export function useFlagsStatus(): FlagsStatus {
	return useFromClient<FlagsStatus>((client) => client.flags.status, 'idle');
}

/** The Live connection: `off`, `connecting`, `open`, `polling` or `closed`. */
export function useLiveStatus(): LiveStatus {
	return useFromClient<LiveStatus>((client) => client.live.status, 'off');
}

/** A resource, with a way to fetch it again. */
export type ResourceState<T> = Resource<T> & { readonly refresh: () => Promise<void> };

/** Reads one of the package's resources, or your own made with `resource()`. */
export function useResource<T>(store: ResourceStore<T>): ResourceState<T> {
	const state = useWatch(store);
	return useMemo(() => ({ ...state, refresh: store.refresh }), [state, store]);
}

/** The person's workspaces, with names and logos, for a chooser. */
export function useWorkspaces(): ResourceState<readonly MyWorkspace[]> {
	return useResource(workspaces);
}

/** The signed-in person's profile. */
export function useMe(): ResourceState<Me> {
	return useResource(me);
}

/** The workspace's billing facts: plan, status, trial, limits and usage. For showing, never for gating. */
export function useBilling(): ResourceState<BillingFacts> {
	return useResource(billing);
}

/** The plans on offer. */
export function usePlans(): ResourceState<readonly Plan[]> {
	return useResource(plans);
}

/** This period's usage of each metric, with its limit. */
export function useUsage(): ResourceState<UsageNumbers> {
	return useResource(usage);
}

/** The current workspace: its id and standing, with its name, logo and the person's role from their workspaces. */
export type CurrentWorkspace = MyWorkspace & { readonly standing: string | null };

/** The current workspace, or null when nobody is signed in or no workspace is chosen. */
export function useWorkspace(): CurrentWorkspace | null {
	const session = useSession();
	const list = useWorkspaces();
	return useMemo(() => {
		if (session.status !== 'signed-in' || session.workspace === null) return null;
		const id = session.workspace.id;
		const found = list.value?.find((w) => w.id === id);
		return {
			id,
			name: found?.name ?? null,
			logo: found?.logo ?? null,
			member: found?.member ?? '',
			role: found?.role ?? '',
			status: found?.status ?? '',
			standing: session.workspace.standing,
		};
	}, [session, list.value]);
}

/**
 * A flag's value and why it has it. Every gate is a flag, and its rule says
 * why (a privilege, a plan feature or a rollout). A flag Bridge gave no
 * result for gives `fallback` (default `false`), so gates fail closed.
 *
 * ```tsx
 * const reports = useFlag('reports');
 * return reports.value ? <Reports /> : null;
 * ```
 */
export function useFlag<T = boolean>(key: string, fallback?: T): { readonly value: T; readonly reason: FlagReason | null } {
	const client = useBridge();
	const flags = useFlags();
	const otherwise = (fallback ?? false) as T;
	return useMemo(
		() => ({
			value: client === null ? otherwise : client.flags.get<T>(key, otherwise),
			reason: client === null ? null : client.flags.reason(key),
		}),
		// `flags` changes whenever a result does.
		[client, flags, key, otherwise],
	);
}

/** Whether the person may manage billing: the `billingManage` flag. */
export function useCanManageBilling(): boolean {
	const config = useBridgeConfig();
	return useFlag(config?.flagKeys.billingManage ?? '').value === true && config !== null;
}

/** Whether the person may manage the team: the `teamManage` flag. */
export function useCanManageTeam(): boolean {
	const config = useBridgeConfig();
	return useFlag(config?.flagKeys.teamManage ?? '').value === true && config !== null;
}

/** The open upgrade request, or null. */
export function useUpgradeRequest(): UpgradeRequest | null {
	return useWatch(upgradeRequest);
}

/**
 * The translator for a component: the shared catalogue, the plugin's own
 * keys, the app's `messages` and the component's own, last wins.
 */
export function useTranslator(messages?: BridgeMessages): BridgeTranslator {
	const config = useBridgeConfig();
	return useMemo(() => translator(messages), [config, messages]);
}

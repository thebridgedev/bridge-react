/**
 * `<BridgeProvider>`: wrap the app in it, once, around the router's pages.
 * It makes the page's Bridge client, sends email links to their pages,
 * guards every navigation with the route rules, runs the guard again when
 * the session or the flags change (a sign-out in another tab, a workspace
 * switch, a flag turned off), and renders the upgrade dialog a plan limit
 * opens.
 *
 * ```tsx
 * const config: BridgeConfig = { issuer: import.meta.env.VITE_BRIDGE_ISSUER, rules: [{ match: '/', public: true }] };
 * <BridgeProvider config={config}><App /></BridgeProvider>
 * ```
 *
 * Define `config` outside the component (or memoise it): a new object is a
 * new configuration.
 */
import { readEmailLink, readReturnTo, type Bridge } from '@nebulr-group/bridge-auth-core';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { startClient } from '../core/client.js';
import { resolveConfig, type BridgeConfig, type ResolvedConfig } from '../core/config.js';
import { decide, normalizePath, type GuardDecision } from '../core/guard.js';
import { authPageAt, isUnder, pageForLink } from '../core/routes.js';
import { browserLocation, browserNavigate, setRouter, type BridgeLocation, type BridgeRouter } from '../core/router.js';
import { closeUpgrade } from '../core/upgrade.js';
import { RouterContext } from '../react/context.js';
import { useCanManageBilling, useFlags, useFlagsStatus, useSession, useUpgradeRequest, useWatch } from '../react/hooks.js';
import UpgradeDialog from './billing/UpgradeDialog.js';

/** How long a navigation waits for Bridge before deciding as if nobody were signed in. */
const READY_WAIT_MS = 8000;

function within<T>(promise: Promise<T>, ms: number): Promise<T | undefined> {
	return new Promise((resolve) => {
		const timer = setTimeout(() => resolve(undefined), ms);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			() => {
				clearTimeout(timer);
				resolve(undefined);
			},
		);
	});
}

export interface BridgeProviderProps {
	/** The settings. The one required one is `issuer`. */
	readonly config: BridgeConfig;
	/**
	 * Your router's location and navigate function, so the router sees every
	 * navigation the package makes. @default the browser's history
	 */
	readonly router?: BridgeRouter;
	/** Shown while the first navigation waits for Bridge. @default nothing */
	readonly loading?: ReactNode;
	/** Shown when a page's flag is off and its redirect is the page itself. */
	readonly forbidden?: ReactNode;
	readonly children?: ReactNode;
}

/** Where a navigation must go before the guard decides, or null. */
function preGuard(config: ResolvedConfig, location: BridgeLocation): string | null {
	const path = normalizePath(location.pathname);
	// An email link lands on the email-links address with its token in the fragment: on to its page.
	const link = readEmailLink(location.hash);
	if (link !== null) {
		const page = `${config.authBase}/${pageForLink(link)}`;
		if (path !== page) return `${page}${location.hash}`;
	}
	if (config.authBase !== '' && path === config.authBase) return `${config.authBase}/sign-in${location.search}`;
	return null;
}

/** Who the flag results are for: they are fetched again whenever it changes. */
function sessionKey(client: Bridge): string {
	const s = client.session.get();
	return s.status === 'signed-in' ? `${s.user.id}|${s.workspace?.id ?? ''}` : s.status;
}

export function BridgeProvider({ config, router, loading = null, forbidden, children }: BridgeProviderProps) {
	const resolved = useMemo(() => resolveConfig(config), [config]);
	const client = useMemo(() => startClient(resolved), [resolved]);

	const browserAt = useWatch(browserLocation);
	const active: BridgeRouter = router ?? { location: browserAt, navigate: browserNavigate };
	const location = active.location;
	const navigateRef = useRef(active.navigate);
	navigateRef.current = active.navigate;
	const stableRouter = useMemo<BridgeRouter>(
		() => ({ location, navigate: (to, options) => navigateRef.current(to, options) }),
		[location.pathname, location.search, location.hash],
	);
	useLayoutEffect(() => {
		setRouter(stableRouter);
	}, [stableRouter]);
	useEffect(() => () => setRouter(null), []);

	const session = useSession();
	useFlags();
	const flagsStatus = useFlagsStatus();

	// The client's start: its metadata read and any kept session restored, or a time limit.
	const [ready, setReady] = useState(false);
	useEffect(() => {
		let live = true;
		setReady(false);
		void within(client.ready, READY_WAIT_MS).then(() => {
			if (live) setReady(true);
		});
		return () => {
			live = false;
		};
	}, [client]);

	// A sign-in request in the address is taken once, then the page loads again without it: while it is unspent,
	// anyone holding it could sign in on it.
	const requestInAddress = resolved.signInRequests && new URLSearchParams(location.search).has('request');
	useEffect(() => {
		if (!requestInAddress) return;
		const params = new URLSearchParams(location.search);
		const request = params.get('request') ?? '';
		let live = true;
		void client.request
			.use(request)
			.catch(() => undefined)
			.finally(() => {
				if (!live) return;
				params.delete('request');
				const query = params.toString();
				stableRouter.navigate(`${location.pathname}${query === '' ? '' : `?${query}`}${location.hash}`, { replace: true });
			});
		return () => {
			live = false;
		};
	}, [client, requestInAddress, location.search]);

	const before = preGuard(resolved, location);
	useEffect(() => {
		if (before !== null) stableRouter.navigate(before, { replace: true });
	}, [before]);

	// Flag results for this person and workspace: a page behind a flag waits for them (or a time limit).
	const path = normalizePath(location.pathname);
	const flagsNeeded = authPageAt(path, resolved.authBase) === null;
	const key = ready ? sessionKey(client) : 'starting';
	const [flagsWaitedFor, setFlagsWaitedFor] = useState<string | null>(null);
	useEffect(() => {
		if (!ready || !flagsNeeded || flagsStatus === 'ready' || flagsWaitedFor === key) return;
		let live = true;
		void within(client.flags.load(), READY_WAIT_MS).then(() => {
			if (live) setFlagsWaitedFor(key);
		});
		return () => {
			live = false;
		};
	}, [ready, flagsNeeded, flagsStatus, key, flagsWaitedFor, client]);

	const settled = ready && !requestInAddress && before === null && (!flagsNeeded || flagsStatus === 'ready' || flagsWaitedFor === key);
	// A path under the auth base that is none of its pages is `<BridgeAuthRoutes>`'s not-found, for everyone.
	const unknownAuthPage = resolved.authBase !== '' && isUnder(path, resolved.authBase) && flagsNeeded;
	const decision: GuardDecision | null = !settled
		? null
		: unknownAuthPage
			? { type: 'allow' }
			: decide(resolved, {
				path: location.pathname,
				target: `${path}${location.search}`,
				session,
				flags: client.flags,
				returnTo: readReturnTo(location.search, resolved.returnToParam),
				});

	useEffect(() => {
		if (decision?.type === 'sign-in' || decision?.type === 'redirect') stableRouter.navigate(decision.to, { replace: true });
	}, [decision?.type, decision?.type === 'sign-in' || decision?.type === 'redirect' ? decision.to : null]);

	// While the guard waits again (a reload of the flags after a sign-in), the page it allowed stays on screen.
	const allowed = useRef<string | null>(null);
	if (decision?.type === 'allow') allowed.current = `${path}${location.search}`;
	else if (decision !== null) allowed.current = null;
	const showPage = decision?.type === 'allow' || (decision === null && allowed.current === `${path}${location.search}`);

	const request = useUpgradeRequest();
	const mayUpgrade = useCanManageBilling();
	const Dialog = resolved.upgradeDialog === true || resolved.upgradeDialog === false ? UpgradeDialog : resolved.upgradeDialog;
	const upgradeHref = resolved.paywall ?? `${resolved.billingBase}/plan`;

	return (
		<RouterContext.Provider value={stableRouter}>
			{showPage ? children : decision?.type === 'forbidden' ? (forbidden ?? <p data-bridge-forbidden>Forbidden</p>) : loading}
			{resolved.upgradeDialog !== false && request !== null && (
				<Dialog request={request} upgradeHref={upgradeHref} canUpgrade={mayUpgrade} onClose={closeUpgrade} />
			)}
		</RouterContext.Provider>
	);
}

export default BridgeProvider;

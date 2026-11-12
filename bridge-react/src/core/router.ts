/**
 * How the package reads the address and moves between pages, without
 * depending on a router. `<BridgeProvider>` takes one: by default the
 * browser's own history; with React Router, TanStack Router or Wouter, the
 * router's location and navigate function, so the router sees every
 * navigation the package makes:
 *
 * ```tsx
 * const location = useLocation();
 * const navigate = useNavigate();
 * <BridgeProvider config={config} router={{ location, navigate }}>…
 * ```
 */
import { Value } from './value.js';

export interface BridgeLocation {
	readonly pathname: string;
	/** The query, with its `?`, or `''`. */
	readonly search: string;
	/** The fragment, with its `#`, or `''`. */
	readonly hash: string;
}

export interface BridgeRouter {
	/** Where the browser is now. */
	readonly location: BridgeLocation;
	/** Goes to a path of this app (`/reports?x=1`). With `replace`, the current history entry is replaced. */
	navigate(to: string, options?: { replace?: boolean }): void;
}

/** The router `<BridgeProvider>` was given, for code outside components. */
const routerValue = new Value<BridgeRouter | null>(null);

export function setRouter(router: BridgeRouter | null): void {
	routerValue.set(router);
}

/** Goes to a path of this app, through the app's router. Before `<BridgeProvider>`, through the browser. */
export function navigate(to: string, options: { replace?: boolean } = {}): void {
	const router = routerValue.get();
	if (router !== null) {
		router.navigate(to, options);
		return;
	}
	browserNavigate(to, options);
}

const NAVIGATED = 'bridge:navigate';

function readLocation(): BridgeLocation {
	if (typeof window === 'undefined') return { pathname: '/', search: '', hash: '' };
	const { pathname, search, hash } = window.location;
	return { pathname, search, hash };
}

/** The browser's address, watched: changes on back and forward, and on every navigation made through `browserNavigate`. */
export const browserLocation = new Value<BridgeLocation>(readLocation());

function refresh(): void {
	const next = readLocation();
	const now = browserLocation.get();
	if (now.pathname !== next.pathname || now.search !== next.search || now.hash !== next.hash) browserLocation.set(next);
}

if (typeof window !== 'undefined') {
	window.addEventListener('popstate', refresh);
	window.addEventListener('hashchange', refresh);
	window.addEventListener(NAVIGATED, refresh);
}

/** Navigates with the History API and tells every reader of `browserLocation`. */
export function browserNavigate(to: string, options: { replace?: boolean } = {}): void {
	if (typeof window === 'undefined') return;
	if (options.replace) window.history.replaceState(null, '', to);
	else window.history.pushState(null, '', to);
	window.dispatchEvent(new Event(NAVIGATED));
}

/** The default router: the browser's history. */
export function browserRouter(): BridgeRouter {
	return { location: browserLocation.get(), navigate: browserNavigate };
}

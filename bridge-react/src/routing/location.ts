/**
 * TBP-743 — what `<BridgeAuthRoutes>` and `<BridgeBillingRoutes>` need from a
 * router, and nothing more. The route components are router-agnostic: a router
 * adapter (`@nebulr-group/bridge-react/react-router`,
 * `@nebulr-group/bridge-react/tanstack-router`) fills this in from the router's
 * own hooks; with no router, it is read from `window.location` below a `base`
 * path and navigation goes through the SDK's router adapter.
 */
import { useEffect, useMemo, useState } from 'react';
import { getRouterAdapter } from '../utils/router-adapter';
import { restBelow } from '../core/auth-routes';

export interface BridgeRouteLocation {
  /** The full pathname, e.g. `/auth/login`. */
  pathname: string;
  /** The query string, with its `?`, or `''`. */
  search: string;
  /**
   * The part of the path below where the component is mounted, e.g. `login`
   * or `set-password/abc` under `/auth/*`. `null` when the current path is not
   * under the mount point at all.
   */
  rest: string | null;
  /** Navigate within the app. */
  navigate: (to: string, options?: { replace?: boolean }) => void;
}

function readWindow(): { pathname: string; search: string } {
  if (typeof window === 'undefined' || !window.location) return { pathname: '/', search: '' };
  const { pathname, search } = window.location;
  return {
    pathname: typeof pathname === 'string' && pathname ? pathname : '/',
    search: typeof search === 'string' ? search : '',
  };
}

/**
 * The location from `window.location`, for an app with no router adapter.
 * Re-reads on `popstate`; navigation goes through `getRouterAdapter()` (a
 * full page load unless the app registered its router with `setRouterAdapter`).
 */
export function useWindowRouteLocation(base: string): BridgeRouteLocation {
  const [loc, setLoc] = useState(readWindow);
  useEffect(() => {
    const onPop = () => setLoc(readWindow());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return useMemo(
    () => ({
      pathname: loc.pathname,
      search: loc.search,
      rest: restBelow(loc.pathname, base),
      navigate: (to, options) => {
        const router = getRouterAdapter();
        if (options?.replace) router.replace(to);
        else router.navigate(to);
      },
    }),
    [loc, base],
  );
}

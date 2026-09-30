/**
 * `@nebulr-group/bridge-react/tanstack-router` — the TanStack Router adapter
 * (TBP-743). TanStack Router is an optional peer: only apps that import this
 * entry need it installed.
 *
 *   import { BridgeAuthRoutes, BridgeBillingRoutes } from '@nebulr-group/bridge-react/tanstack-router';
 *
 *   const authRoute = createRoute({ getParentRoute: () => rootRoute, path: 'auth/$', component: BridgeAuthRoutes });
 *   const subscriptionRoute = createRoute({ getParentRoute: () => rootRoute, path: 'subscription/$', component: BridgeBillingRoutes });
 *
 * Both components read the matched splat (`$` → `_splat`) from TanStack
 * Router and navigate through its history, so moving between Bridge's pages
 * never reloads the app. They also register the router as the SDK's router
 * adapter, so `<ProtectedRoute>`, the OAuth callback and the paywall redirect
 * navigate in-app too. `useBridgeRouter()` does only that last part.
 *
 * With file-based routing, render them from `src/routes/auth/$.tsx` and
 * `src/routes/subscription/$.tsx`:
 *
 *   export const Route = createFileRoute('/auth/$')({ component: BridgeAuthRoutes });
 */
import { useEffect, useMemo } from 'react';
import { useLocation, useParams, useRouter } from '@tanstack/react-router';
import {
  BridgeAuthRoutes as CoreBridgeAuthRoutes,
  type BridgeAuthRoutesProps,
} from '../components/sdk-auth/BridgeAuthRoutes';
import {
  BridgeBillingRoutes as CoreBridgeBillingRoutes,
  type BridgeBillingRoutesProps,
} from '../components/subscription/BridgeBillingRoutes';
import type { BridgeRouteLocation } from '../routing/location';
import { setRouterAdapter } from '../utils/router-adapter';

export type { BridgeRouteLocation, BridgeAuthRoutesProps, BridgeBillingRoutesProps };

type History = { push: (href: string) => void; replace: (href: string) => void };

/** Register the TanStack router as the SDK's router adapter while mounted. */
export function useBridgeRouter(): void {
  const router = useRouter();
  useEffect(() => {
    const history = router.history as unknown as History;
    setRouterAdapter({
      navigate: (path, options) => (options?.replace ? history.replace(path) : history.push(path)),
      replace: (path) => history.replace(path),
      getCurrentPath: () => router.state.location.pathname,
    });
  }, [router]);
}

/** The current location as the Bridge route components read it. */
export function useBridgeRouteLocation(): BridgeRouteLocation {
  const router = useRouter();
  const location = useLocation();
  const params = useParams({ strict: false }) as { _splat?: string };
  const rest = params._splat ?? '';
  const search = (location as { searchStr?: string }).searchStr ?? '';
  return useMemo(
    () => ({
      pathname: location.pathname,
      search,
      rest,
      // Through the history, not `navigate({ to })`: a Bridge link carries its
      // query (`?redirectUri=…`) in the string, and the history takes an href.
      navigate: (to, options) => {
        const history = router.history as unknown as History;
        if (options?.replace) history.replace(to);
        else history.push(to);
      },
    }),
    [location.pathname, search, rest, router],
  );
}

/** Every sign-in page, mounted on a `auth/$` route. */
export function BridgeAuthRoutes(props: Omit<BridgeAuthRoutesProps, 'location' | 'base'>) {
  useBridgeRouter();
  return <CoreBridgeAuthRoutes {...props} location={useBridgeRouteLocation()} />;
}

/** The subscription pages, mounted on a `subscription/$` route. */
export function BridgeBillingRoutes(props: Omit<BridgeBillingRoutesProps, 'location' | 'base'>) {
  useBridgeRouter();
  return <CoreBridgeBillingRoutes {...props} location={useBridgeRouteLocation()} />;
}

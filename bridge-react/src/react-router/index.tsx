/**
 * `@nebulr-group/bridge-react/react-router` — the React Router adapter
 * (TBP-743). React Router is an optional peer: only apps that import this
 * entry need it installed. Works with React Router 6.4+ and 7.
 *
 *   import { BridgeAuthRoutes, BridgeBillingRoutes } from '@nebulr-group/bridge-react/react-router';
 *
 *   <Routes>
 *     <Route path="/auth/*" element={<BridgeAuthRoutes />} />
 *     <Route path="/subscription/*" element={<BridgeBillingRoutes />} />
 *     …
 *   </Routes>
 *
 * Both components read the matched splat (`*`) from React Router and navigate
 * with its `navigate`, so moving between Bridge's pages never reloads the app.
 * They also register React Router as the SDK's router adapter, so
 * `<ProtectedRoute>`, the OAuth callback and the paywall redirect navigate
 * in-app too. `useBridgeRouter()` does only that last part, for an app that
 * renders neither component.
 */
import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
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

/** Register React Router's `navigate` as the SDK's router adapter while mounted. */
export function useBridgeRouter(): void {
  const navigate = useNavigate();
  useEffect(() => {
    setRouterAdapter({
      navigate: (path, options) => navigate(path, { replace: options?.replace }),
      replace: (path) => navigate(path, { replace: true }),
      getCurrentPath: () => window.location.pathname,
    });
  }, [navigate]);
}

/** The current location as the Bridge route components read it. */
export function useBridgeRouteLocation(): BridgeRouteLocation {
  const location = useLocation();
  const params = useParams();
  const navigate = useNavigate();
  const rest = params['*'] ?? '';
  return useMemo(
    () => ({
      pathname: location.pathname,
      search: location.search,
      rest,
      navigate: (to, options) => navigate(to, { replace: options?.replace }),
    }),
    [location.pathname, location.search, rest, navigate],
  );
}

/** Every sign-in page, mounted with `<Route path="/auth/*" element={<BridgeAuthRoutes />} />`. */
export function BridgeAuthRoutes(props: Omit<BridgeAuthRoutesProps, 'location' | 'base'>) {
  useBridgeRouter();
  return <CoreBridgeAuthRoutes {...props} location={useBridgeRouteLocation()} />;
}

/** The subscription pages, mounted with `<Route path="/subscription/*" element={<BridgeBillingRoutes />} />`. */
export function BridgeBillingRoutes(props: Omit<BridgeBillingRoutesProps, 'location' | 'base'>) {
  useBridgeRouter();
  return <CoreBridgeBillingRoutes {...props} location={useBridgeRouteLocation()} />;
}

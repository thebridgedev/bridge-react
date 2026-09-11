import { ReactNode, useEffect } from 'react';
import { useAuth } from '../../hooks/use-auth';
import { useBridgeStore } from '../../core/bridge-instance';
import { getRouterAdapter } from '../../utils/router-adapter';
import { currentAttemptedPath, resolveReturnTo, returnToParam } from '../../utils/return-to';
import { stashReturnTo, withReturnTo } from '@nebulr-group/bridge-auth-core';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * A component that protects routes from unauthenticated access.
 *
 * When the user is not authenticated the guard redirects them to log in. The
 * destination depends on how Bridge is configured — mirroring bridge-svelte's
 * `BridgeBootstrap` login branch:
 *
 * - **Hosted mode (default, no `loginRoute`):** launches the hosted auth portal
 *   via `login()` (`bridge.createLoginUrl()` → `window.location`).
 * - **SDK mode (`loginRoute` configured on `BridgeConfig`):** navigates to that
 *   in-app route using the SDK's router adapter, so the app can render its own
 *   in-app auth surface (`<LoginForm />` etc.) instead of leaving the app.
 *
 * @example Basic usage
 * ```tsx
 * <ProtectedRoute>
 *   <YourProtectedComponent />
 * </ProtectedRoute>
 * ```
 *
 * @example With React Router
 * ```tsx
 * // In your App.tsx
 * import { setRouterAdapter } from '@nebulr-group/bridge-react';
 *
 * function App() {
 *   const navigate = useNavigate();
 *
 *   useEffect(() => {
 *     setRouterAdapter({
 *       navigate: (path, opts) => navigate(path, { replace: opts?.replace }),
 *       replace: (path) => navigate(path, { replace: true }),
 *       getCurrentPath: () => window.location.pathname
 *     });
 *   }, [navigate]);
 *
 *   return <Routes>...</Routes>;
 * }
 * ```
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, login } = useAuth();
  // Resolved in-app login route (config.loginRoute), captured at init. When set
  // we redirect in-app; when null we fall back to the hosted portal.
  const loginRoute = useBridgeStore((s) => s.loginRoute);

  // Auto-initiate login if not authenticated.
  useEffect(() => {
    if (isLoading || isAuthenticated) return;

    // TBP-629 — carry the page they actually asked for through the login, so a
    // deep link does not collapse to the app's default route. `null` when there
    // is nothing safe or worth carrying, and every call below tolerates null by
    // behaving exactly as it did before this existed.
    const returnTo = resolveReturnTo(currentAttemptedPath());

    if (loginRoute) {
      // SDK mode: consumer set loginRoute → navigate to the in-app login view
      // using the same router adapter the rest of the SDK uses. The target rides
      // as a query parameter because the login page is ours to read, and because
      // a parameter survives a cross-tab click — which is the emailed-link case
      // that prompted this.
      getRouterAdapter().navigate(withReturnTo(loginRoute, returnTo, returnToParam()));
    } else {
      // Hosted mode (default): no loginRoute → launch the hosted auth portal.
      //
      // Here the target CANNOT ride on the URL. `createLoginUrl()` feeds
      // `redirectUri` to the OAuth authorize call and bridge-api validates it
      // with an exact `allowedRedirectUris.includes()` match, so appending a
      // query would break login rather than improve it. Stash it instead;
      // <CallbackHandler> picks it up when the round-trip lands back on our
      // origin, in the same tab that wrote it.
      stashReturnTo(returnTo);
      login();
    }
  }, [isAuthenticated, isLoading, login, loginRoute]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <p>Loading...</p>
      </div>
    );
  }

  // If not authenticated, render nothing (login flow will start immediately)
  if (!isAuthenticated) {
    return null;
  }

  // Render the protected content
  return <>{children}</>;
}

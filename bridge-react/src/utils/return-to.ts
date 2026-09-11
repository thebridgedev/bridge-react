/**
 * Deep-link preservation for `<ProtectedRoute>` (TBP-629).
 *
 * `<ProtectedRoute>` turns an unauthenticated visitor away without recording
 * what they asked for, so a link into a protected screen collapses to the app's
 * default route after login. That failure is silent — no error, and the URL the
 * visitor followed is simply gone — which reads as a broken feature rather than
 * a routing default.
 *
 * The decision of WHAT is safe to carry is auth-core's, not this package's. We
 * borrow the route guard purely for its `resolveReturnTo`, so the exclusion
 * rules and the open-redirect validation are the same code bridge-svelte and
 * bridge-nextjs run. A second implementation here is a second thing to get
 * wrong, and the way this gets got wrong is an open redirect.
 */
import { getBridgeAuth, getBridgeConfig } from '../core/bridge-instance';
import { getRouterAdapter } from './router-adapter';
import { logger } from './logger';

/**
 * The full path+query the visitor is currently on.
 *
 * The PATH comes from the router adapter, not `window.location`. An app on
 * TanStack Router or a memory history has a router location that is the truth
 * and a `window.location` that may not be; reading the window directly would be
 * going behind the adapter's back on the one question the adapter exists to
 * answer. The default adapter reads `window.location.pathname` anyway, so apps
 * without a router are unaffected.
 *
 * The QUERY still comes from the window: `RouterAdapter` exposes no accessor for
 * it, and every router that matters keeps the address bar in sync. Query is part
 * of the deep link for plenty of routes — an exported-file link that loses its
 * `?key=` is as broken as one that loses its path.
 *
 * The hash is deliberately dropped: it never reaches the server and survives the
 * redirect on its own in most browsers.
 */
export function currentAttemptedPath(): string | null {
  let pathname: string;
  try {
    pathname = getRouterAdapter().getCurrentPath();
  } catch {
    if (typeof window === 'undefined') return null;
    pathname = window.location.pathname;
  }
  if (!pathname) return null;

  const search = typeof window !== 'undefined' ? window.location.search : '';
  return `${pathname}${search}`;
}

/**
 * Reduce the attempted path to something safe to return to after login, or
 * null when there is nothing worth carrying.
 *
 * Null covers every "just use your default route" case: opted out, excluded,
 * the login route itself, an unsafe value, or a browserless context.
 */
export function resolveReturnTo(attempted: string | null | undefined): string | null {
  if (!attempted) return null;

  const config = getBridgeConfig();
  if (config?.returnTo?.enabled === false) return null;

  try {
    // `defaultAccess: 'protected'` with no rules is the truthful description of
    // this package's model: <ProtectedRoute> wraps what it protects, so any path
    // that reached the login branch was protected by construction. The guard's
    // public-route rejection then correctly never fires.
    const guard = getBridgeAuth().createRouteGuard({
      rules: [],
      defaultAccess: 'protected',
      returnTo: {
        ...config?.returnTo,
        // The app already told us where its login page is. Making them repeat it
        // under `returnTo` would be a second source of truth that can drift, and
        // the failure when it drifts is a login page that returns to itself.
        loginRoute: config?.returnTo?.loginRoute ?? config?.loginRoute,
      },
    });
    return guard.resolveReturnTo(attempted);
  } catch (err) {
    // BridgeAuth not initialised yet. Losing a deep link is the bug being fixed
    // here; blocking a login would be worse.
    logger.debug('[return-to] could not resolve return target', err);
    return null;
  }
}

/** Query parameter the return target travels on, honouring config. */
export function returnToParam(): string | undefined {
  return getBridgeConfig()?.returnTo?.param;
}

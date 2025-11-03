import { RouterAdapter } from '../../types/router';

/**
 * Router adapter for TanStack Router
 * 
 * This is a helper to create a router adapter for TanStack Router.
 * You need to call this inside your component where you have access to useRouter().
 * 
 * @example
 * ```typescript
 * import { useRouter } from '@tanstack/react-router';
 * import { setRouterAdapter, createTanStackRouterAdapter } from '@nebulr-group/bridge-react';
 * 
 * function App() {
 *   const router = useRouter();
 *   
 *   useEffect(() => {
 *     setRouterAdapter(createTanStackRouterAdapter(router));
 *   }, [router]);
 *   
 *   return <YourApp />;
 * }
 * ```
 */
export const createTanStackRouterAdapter = (
  router: {
    navigate: (opts: { to: string; replace?: boolean }) => void;
    state: { location: { pathname: string } };
  }
): RouterAdapter => {
  return {
    navigate: (path: string, options?: { replace?: boolean }) => {
      router.navigate({ to: path, replace: options?.replace });
    },
    replace: (path: string) => {
      router.navigate({ to: path, replace: true });
    },
    getCurrentPath: () => router.state.location.pathname
  };
};


import { RouterAdapter } from '../types/router';

/**
 * Default router adapter using window.location
 * Works in any React app without router dependency
 */
export class DefaultRouterAdapter implements RouterAdapter {
  navigate(path: string, options?: { replace?: boolean }): void {
    if (options?.replace) {
      window.location.replace(path);
    } else {
      window.location.href = path;
    }
  }
  
  replace(path: string): void {
    window.location.replace(path);
  }
  
  getCurrentPath(): string {
    return window.location.pathname;
  }
}

// Singleton instance
let routerInstance: RouterAdapter = new DefaultRouterAdapter();

/**
 * Set a custom router adapter
 * 
 * Call this function to configure bridge-react to use your router
 * instead of the default window.location behavior.
 * 
 * @param adapter - Your router adapter implementation
 * 
 * @example React Router v6
 * ```typescript
 * import { useNavigate } from 'react-router-dom';
 * import { setRouterAdapter } from '@nebulr-group/bridge-react';
 * 
 * function App() {
 *   const navigate = useNavigate();
 *   
 *   useEffect(() => {
 *     setRouterAdapter({
 *       navigate: (path, options) => navigate(path, { replace: options?.replace }),
 *       replace: (path) => navigate(path, { replace: true }),
 *       getCurrentPath: () => window.location.pathname
 *     });
 *   }, [navigate]);
 *   
 *   return <YourApp />;
 * }
 * ```
 * 
 * @example TanStack Router
 * ```typescript
 * import { useRouter } from '@tanstack/react-router';
 * import { setRouterAdapter } from '@nebulr-group/bridge-react';
 * 
 * function App() {
 *   const router = useRouter();
 *   
 *   useEffect(() => {
 *     setRouterAdapter({
 *       navigate: (path, options) => router.navigate({ to: path, replace: options?.replace }),
 *       replace: (path) => router.navigate({ to: path, replace: true }),
 *       getCurrentPath: () => router.state.location.pathname
 *     });
 *   }, [router]);
 *   
 *   return <YourApp />;
 * }
 * ```
 */
export const setRouterAdapter = (adapter: RouterAdapter): void => {
  routerInstance = adapter;
};

/**
 * Get the current router adapter
 * 
 * @returns The current router adapter instance
 */
export const getRouterAdapter = (): RouterAdapter => {
  return routerInstance;
};

/**
 * Reset to the default router adapter
 * 
 * Useful for testing or if you want to go back to window.location
 */
export const resetRouterAdapter = (): void => {
  routerInstance = new DefaultRouterAdapter();
};


/**
 * Router adapter interface for framework-agnostic navigation
 * 
 * This interface allows bridge-react to work with any React router
 * (React Router, TanStack Router, Wouter, etc.) or no router at all.
 * 
 * @example Default (no router)
 * ```typescript
 * // Works out of the box using window.location
 * <BridgeProvider>
 *   <App />
 * </BridgeProvider>
 * ```
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
 */
export interface RouterAdapter {
  /**
   * Navigate to a new route
   * @param path - The path to navigate to
   * @param options - Navigation options
   */
  navigate(path: string, options?: { replace?: boolean }): void;
  
  /**
   * Replace current route (doesn't add to history)
   * @param path - The path to navigate to
   */
  replace(path: string): void;
  
  /**
   * Get current pathname
   * @returns The current pathname (e.g., '/dashboard')
   */
  getCurrentPath(): string;
}


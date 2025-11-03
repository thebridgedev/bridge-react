import { RouterAdapter } from '../../types/router';

/**
 * Router adapter for Wouter
 * 
 * This is a helper to create a router adapter for Wouter.
 * You need to call this inside your component where you have access to useLocation().
 * 
 * @example
 * ```typescript
 * import { useLocation } from 'wouter';
 * import { setRouterAdapter, createWouterAdapter } from '@nebulr-group/bridge-react';
 * 
 * function App() {
 *   const [location, setLocation] = useLocation();
 *   
 *   useEffect(() => {
 *     setRouterAdapter(createWouterAdapter(setLocation, location));
 *   }, [setLocation, location]);
 *   
 *   return <YourApp />;
 * }
 * ```
 */
export const createWouterAdapter = (
  setLocation: (path: string, options?: { replace?: boolean }) => void,
  currentLocation: string
): RouterAdapter => {
  return {
    navigate: (path: string, options?: { replace?: boolean }) => {
      setLocation(path, { replace: options?.replace });
    },
    replace: (path: string) => {
      setLocation(path, { replace: true });
    },
    getCurrentPath: () => currentLocation
  };
};


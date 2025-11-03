import { RouterAdapter } from '../../types/router';

/**
 * Router adapter for React Router v6
 * 
 * This is a helper to create a router adapter for React Router v6.
 * You need to call this inside your component where you have access to useNavigate().
 * 
 * @example
 * ```typescript
 * import { useNavigate } from 'react-router-dom';
 * import { setRouterAdapter, createReactRouterAdapter } from '@nebulr-group/bridge-react';
 * 
 * function App() {
 *   const navigate = useNavigate();
 *   
 *   useEffect(() => {
 *     setRouterAdapter(createReactRouterAdapter(navigate));
 *   }, [navigate]);
 *   
 *   return <Routes>...</Routes>;
 * }
 * ```
 */
export const createReactRouterAdapter = (
  navigate: (path: string, options?: { replace?: boolean }) => void
): RouterAdapter => {
  return {
    navigate: (path: string, options?: { replace?: boolean }) => {
      navigate(path, { replace: options?.replace });
    },
    replace: (path: string) => {
      navigate(path, { replace: true });
    },
    getCurrentPath: () => window.location.pathname
  };
};


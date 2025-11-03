import { ReactNode, useEffect } from 'react';
import { useAuth } from '../../hooks/use-auth';
import { getRouterAdapter } from '../../utils/router-adapter';

interface ProtectedRouteProps {
  children: ReactNode;
  redirectTo?: string;
}

/**
 * A component that protects routes from unauthenticated access.
 * If the user is not authenticated, they will be redirected to the specified redirectTo path.
 * 
 * Uses the configured router adapter for navigation. By default, uses window.location.
 * For a better experience with React Router or other routers, configure a router adapter
 * using setRouterAdapter().
 * 
 * @example Basic usage
 * ```tsx
 * <ProtectedRoute redirectTo="/login">
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
export function ProtectedRoute({ 
  children, 
  redirectTo = '/' 
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = getRouterAdapter();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.navigate(redirectTo, { replace: true });
    }
  }, [isAuthenticated, isLoading, redirectTo, router]);

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

  // If not authenticated, don't render anything (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  // Render the protected content
  return <>{children}</>;
}


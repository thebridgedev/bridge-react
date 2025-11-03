import { ReactNode, useEffect } from 'react';
import { useAuth } from '../../hooks/use-auth';

interface ProtectedRouteProps {
  children: ReactNode;
}

/**
 * A component that protects routes from unauthenticated access.
 * If the user is not authenticated, it immediately initiates the hosted login flow.
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
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, login } = useAuth();

  // Auto-initiate hosted login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      login();
    }
  }, [isAuthenticated, isLoading, login]);

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


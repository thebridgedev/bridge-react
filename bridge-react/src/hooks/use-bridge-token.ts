import { useCallback, useEffect, useState } from 'react';
import { AuthService } from '../services/auth.service';
import { TokenService } from '../services/token.service';
import { useBridgeConfig } from './use-bridge-config';

// Initialize services outside component
const tokenService = TokenService.getInstance();
const authService = AuthService.getInstance();

/**
 * Hook for accessing bridge token functionality
 * 
 * @returns Token context values and functions
 * 
 * @example
 * import { useBridgeToken } from '@nebulr-group/bridge-react';
 * 
 * function MyComponent() {
 *   const { isAuthenticated, login, logout } = useBridgeToken();
 *   
 *   return (
 *     <div>
 *       {isAuthenticated ? (
 *         <button onClick={logout}>Logout</button>
 *       ) : (
 *         <button onClick={() => login()}>Login</button>
 *       )}
 *     </div>
 *   );
 * }
 */
export const useBridgeToken = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const config = useBridgeConfig();
  
  // Initialize token service
  useEffect(() => {
    tokenService.init(config);
  }, [config]);
  
  // Check authentication status
  useEffect(() => {
    let isMounted = true;
    
    const checkAuth = async () => {
      try {
        const isAuth = await tokenService.isAuthenticated();
        
        // Only update state if component is still mounted
        if (isMounted) {
          setIsAuthenticated(isAuth);
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'An unknown error occurred');
          setIsLoading(false);
        }
      }
    };

    checkAuth();
    
    return () => {
      isMounted = false;
    };
  }, []);

  const login = useCallback(async (options?: { redirectUri?: string }) => {
    try {
      setIsLoading(true);
      await authService.login(options);
      setIsAuthenticated(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    try {
      tokenService.clearTokens();
      setIsAuthenticated(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  }, []);

  const getAccessToken = useCallback(() => {
    return tokenService.getAccessToken();
  }, []);

  const getRefreshToken = useCallback(() => {
    return tokenService.getRefreshToken();
  }, []);

  const getIdToken = useCallback(() => {
    return tokenService.getIdToken();
  }, []);

  return {
    isAuthenticated,
    isLoading,
    error,
    login,
    logout,
    getAccessToken,
    getRefreshToken,
    getIdToken,
  };
};


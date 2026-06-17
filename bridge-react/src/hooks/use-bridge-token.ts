import { useCallback } from 'react';
import { getBridgeAuth, useBridgeStore } from '../core/bridge-instance';
import { logger } from '../utils/logger';

/**
 * Hook for accessing bridge token state and accessors, backed by the auth-core
 * singleton + reactive bridge store. Powers `<TokenStatus />` and any consumer
 * that needs raw token access alongside the redirect/hosted-auth flow.
 *
 * @example
 * import { useBridgeToken } from '@nebulr-group/bridge-react';
 *
 * function MyComponent() {
 *   const { isAuthenticated, getAccessToken } = useBridgeToken();
 *   // ...
 * }
 */
export const useBridgeToken = () => {
  const tokens = useBridgeStore((s) => s.tokens);
  const isLoading = useBridgeStore((s) => s.isLoading);
  const error = useBridgeStore((s) => s.error);

  const login = useCallback(async (options?: { redirectUri?: string }) => {
    try {
      const bridge = getBridgeAuth();
      const loginUrl = bridge.createLoginUrl(options);
      if (typeof window !== 'undefined') {
        window.location.href = loginUrl;
      }
    } catch (err) {
      logger.error('[useBridgeToken] login failed:', err);
    }
  }, []);

  const logout = useCallback(() => {
    try {
      getBridgeAuth().clearSession();
      useBridgeStore.setState({
        tokens: null,
        profile: null,
        flags: {},
        authState: 'unauthenticated',
        tenantUsers: [],
      });
    } catch (err) {
      logger.error('[useBridgeToken] logout failed:', err);
    }
  }, []);

  const getAccessToken = useCallback(() => getBridgeAuth().getTokens()?.accessToken ?? null, []);
  const getRefreshToken = useCallback(() => getBridgeAuth().getTokens()?.refreshToken ?? null, []);
  const getIdToken = useCallback(() => getBridgeAuth().getTokens()?.idToken ?? null, []);

  return {
    isAuthenticated: !!tokens?.accessToken,
    isLoading,
    error,
    login,
    logout,
    getAccessToken,
    getRefreshToken,
    getIdToken,
  };
};

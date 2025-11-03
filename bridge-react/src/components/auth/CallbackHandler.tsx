import { useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/use-auth';
import { useBridgeConfig } from '../../hooks/use-bridge-config';
import { getRouterAdapter } from '../../utils/router-adapter';

/**
 * Processes bridge OAuth callback on mount and redirects.
 * - Reads `code` and `error` from the current URL
 * - Exchanges code via `useAuth().handleCallback`
 * - Redirects to `defaultRedirectRoute` on success
 * - Redirects to `loginRoute?error=...` on error
 *
 * Renders nothing.
 */
export function CallbackHandler() {
  const { handleCallback } = useAuth();
  const config = useBridgeConfig();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const callbackError = params.get('error');

    const loginRoute = config.loginRoute;
    const successRoute = config.defaultRedirectRoute;

    const router = getRouterAdapter();

    const buildUrl = (path: string, query?: Record<string, string>) => {
      if (!query || Object.keys(query).length === 0) return path;
      const qs = new URLSearchParams(query).toString();
      return `${path}?${qs}`;
    };

    const redirect = (path: string, query?: Record<string, string>) => {
      router.replace(buildUrl(path, query));
    };

    const process = async () => {
      try {
        if (callbackError) {
          return redirect(loginRoute!, { error: callbackError });
        }
        if (!code) {
          return redirect(loginRoute!, { error: 'no_code' });
        }
        await handleCallback(code);
        return redirect(successRoute!);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'auth_failed';
        return redirect(loginRoute!, { error: message });
      }
    };

    process();
  }, [config.defaultRedirectRoute, config.loginRoute, handleCallback]);

  return null;
}

export default CallbackHandler;



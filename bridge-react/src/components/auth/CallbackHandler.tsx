import { useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/use-auth';
import { getBridgeAuth, loadSubscription } from '../../core/bridge-instance';
import { getRouterAdapter } from '../../utils/router-adapter';

export interface CallbackHandlerProps {
  /** Route to redirect to after a successful code exchange. @default '/' */
  successRoute?: string;
  /** Route to redirect to when the callback fails. @default '/login' */
  loginRoute?: string;
  /** Route to redirect to when a Stripe checkout confirmation fails. @default '/payment-error' */
  paymentErrorRoute?: string;
}

/**
 * Processes bridge OAuth callback on mount and redirects.
 * - Reads `code` and `error` from the current URL
 * - Exchanges code via `useAuth().handleCallback` (auth-core singleton)
 * - Redirects to `successRoute` on success
 * - Redirects to `loginRoute?error=...` on error
 *
 * Routes default to `/` (success) and `/login` (error); override via props.
 *
 * Renders nothing.
 */
export function CallbackHandler({
  successRoute = '/',
  loginRoute = '/login',
  paymentErrorRoute = '/payment-error',
}: CallbackHandlerProps = {}) {
  const { handleCallback } = useAuth();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const callbackError = params.get('error');
    const sessionId = params.get('session_id');
    const stripeSuccess = params.has('stripe_success');
    const stripeCancel = params.has('stripe_cancel');
    // Stripe may append its own ?session_id to the redirect destination — strip it.
    const stripeRedirectTo = (params.get('redirect') ?? '/subscription').split('?')[0];

    const router = getRouterAdapter();

    const buildUrl = (path: string, query?: Record<string, string>) => {
      if (!query || Object.keys(query).length === 0) return path;
      const qs = new URLSearchParams(query).toString();
      return `${path}?${qs}`;
    };

    const redirect = (path: string, query?: Record<string, string>) => {
      router.replace(buildUrl(path, query));
    };

    // Preserve allowlisted query params on success redirect (e.g. payment from post-payment callback)
    const preserveParams = ['payment'];
    const preservedQuery: Record<string, string> = {};
    preserveParams.forEach((name) => {
      const value = params.get(name);
      if (value != null) preservedQuery[name] = value;
    });

    const process = async () => {
      try {
        // Stripe Checkout return — confirm the session with bridge-api (which
        // verifies it with Stripe server-side), refresh tokens so the new JWT
        // reads shouldSelectPlan:false, then redirect. Mirrors bridge-svelte's
        // BridgeBootstrap callback handling.
        if (stripeSuccess && sessionId) {
          const bridge = getBridgeAuth();
          const ctx = bridge.getApiContext();
          const res = await fetch(`${ctx.apiBaseUrl}/v1/account/stripe/confirm-checkout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(ctx.accessToken ? { Authorization: `Bearer ${ctx.accessToken}` } : {}),
            },
            body: JSON.stringify({ sessionId, appId: ctx.appId }),
          });
          if (!res.ok) {
            return redirect(paymentErrorRoute);
          }
          await bridge.refreshTokens();
          // Refresh the global subscription store so the destination page
          // (e.g. PlanSelector on /subscription) renders the now-active plan
          // instead of stale "select a plan" state.
          await loadSubscription().catch(() => {});
          return redirect(stripeRedirectTo);
        }
        if (stripeCancel) {
          return redirect(stripeRedirectTo);
        }

        if (callbackError) {
          return redirect(loginRoute, { error: callbackError });
        }
        if (!code) {
          return redirect(loginRoute, { error: 'no_code' });
        }
        await handleCallback(code);
        return redirect(successRoute, Object.keys(preservedQuery).length > 0 ? preservedQuery : undefined);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'auth_failed';
        // A Stripe-confirm failure shouldn't dump the user on the login page.
        if (stripeSuccess) return redirect(paymentErrorRoute);
        return redirect(loginRoute, { error: message });
      }
    };

    process();
  }, [successRoute, loginRoute, paymentErrorRoute, handleCallback]);

  return null;
}

export default CallbackHandler;

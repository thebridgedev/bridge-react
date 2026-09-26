import { useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/use-auth';
import { confirmCheckout, getBridgeAuth, getBridgeConfig, loadSubscription } from '../../core/bridge-instance';
import { getRouterAdapter } from '../../utils/router-adapter';
import { sanitizeReturnTo, takeReturnTo } from '@nebulr-group/bridge-auth-core';

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
    // `redirect` rides on the Stripe return URL, so whoever wrote that link
    // controls it. The default router adapter navigates with
    // `window.location.replace`, so an unchecked `https://…` or `//host` value
    // would bounce the user off-site from our own callback: an open redirect.
    // auth-core's `sanitizeReturnTo` admits only a same-origin path; anything
    // else falls back to the default, like a missing value does.
    // Stripe may append its own ?session_id to the redirect destination — strip it.
    const stripeRedirectTo = (sanitizeReturnTo(params.get('redirect')) ?? '/subscription').split('?')[0];

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

    // TBP-723 — the paywall check for a Stripe return runs HERE, after the
    // checkout is confirmed, not in <BridgeProvider>'s mount effect (which
    // skips the callback route). Same order as bridge-svelte's bootstrap:
    // confirm → token refresh → paywall. With the refreshed token a paid
    // tenant reads shouldSelectPlan:false and lands on its destination; a
    // tenant that still has to pick a plan (e.g. a cancelled checkout) goes to
    // the paywall, as the next page's bootstrap check would have sent it.
    const redirectAfterCheckout = async (destination: string) => {
      const paywallRoute = getBridgeConfig()?.billing?.paywallRoute;
      if (paywallRoute && destination !== paywallRoute) {
        const should = await getBridgeAuth()
          .shouldRedirectToPaywall()
          .catch(() => false); // fail open, like the provider's check
        if (should) return redirect(paywallRoute);
      }
      return redirect(destination);
    };

    const process = async () => {
      try {
        // Stripe Checkout return — confirm the session with bridge-api (which
        // verifies it with Stripe server-side), refresh tokens so the new JWT
        // reads shouldSelectPlan:false, then redirect. Mirrors bridge-svelte's
        // BridgeBootstrap callback handling.
        if (stripeSuccess && sessionId) {
          // confirmStripeCheckout (auth-core) verifies the session with bridge-api
          // (which calls Stripe server-side) and refreshes tokens so the new JWT
          // reads shouldSelectPlan:false. It throws on a non-OK response or network
          // error → caught below → paymentErrorRoute. (TBP-369: shared with
          // bridge-svelte so the HTTP + token-refresh logic lives in one place.)
          //
          // `confirmCheckout` registers the confirmation so the provider's
          // paywall check waits for it instead of racing it (TBP-723).
          await confirmCheckout(sessionId);
          // Refresh the global subscription store so the destination page
          // (e.g. PlanSelector on /subscription) renders the now-active plan
          // instead of stale "select a plan" state.
          await loadSubscription().catch(() => {});
          return await redirectAfterCheckout(stripeRedirectTo);
        }
        if (stripeCancel) {
          return await redirectAfterCheckout(stripeRedirectTo);
        }

        if (callbackError) {
          return redirect(loginRoute, { error: callbackError });
        }
        if (!code) {
          return redirect(loginRoute, { error: 'no_code' });
        }
        await handleCallback(code);
        // TBP-629 — restore the deep link <ProtectedRoute> stashed before it
        // sent this visitor to the hosted portal. One-shot and re-sanitized, and
        // null when nothing was stashed — so an app with no deep linking lands
        // on `successRoute` exactly as it always did.
        //
        // `preservedQuery` (today: `payment`) wins: it signals a just-completed
        // checkout whose landing page the billing flow owns, and that is a
        // deliberate destination rather than a remembered one.
        const stashedReturnTo = takeReturnTo();
        if (Object.keys(preservedQuery).length > 0) {
          return redirect(successRoute, preservedQuery);
        }
        return redirect(stashedReturnTo ?? successRoute);
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

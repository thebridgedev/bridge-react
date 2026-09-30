/**
 * TBP-743 (port of bridge-svelte TBP-696) — every sign-in page from one route.
 *
 *   // React Router
 *   import { BridgeAuthRoutes } from '@nebulr-group/bridge-react/react-router';
 *   <Route path="/auth/*" element={<BridgeAuthRoutes />} />
 *
 *   // TanStack Router
 *   import { BridgeAuthRoutes } from '@nebulr-group/bridge-react/tanstack-router';
 *   createRoute({ getParentRoute: () => rootRoute, path: 'auth/$', component: BridgeAuthRoutes })
 *
 *   // No router: mounted wherever the app renders it for paths under `base`
 *   import { BridgeAuthRoutes } from '@nebulr-group/bridge-react';
 *   <BridgeAuthRoutes base="/auth" />
 *
 * Serves login, signup, oauth-callback, set-password/:token, forgot-password,
 * magic-link, setup-passkey/:token and workspaces. Which sign-in methods show
 * (magic link, passkeys, SSO) comes from the app's auth config at runtime, so
 * an operator toggles them without a deploy.
 *
 * Customising, in rungs:
 *   1. `--bridge-*` CSS tokens restyle the forms.
 *   2. `frame(page, children)` replaces everything around the form on every
 *      page; `heading(page)` replaces the form heading on each page's main step.
 *   3. Take over one page by passing an element:
 *        <BridgeAuthRoutes pages={{ login: <MyLoginPage /> }} />
 *      Every other page keeps working.
 *   4. Headless: build on `getBridgeAuth()`.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import type { MessageOverrides } from '@nebulr-group/bridge-auth-core';
import { readReturnTo, withReturnTo } from '@nebulr-group/bridge-auth-core';
import { getBridgeAuth, useBridgeStore } from '../../core/bridge-instance';
import { bridgeAuthBase, parseBridgeAuthRoute, type BridgeAuthPage, type BridgeAuthRoute } from '../../core/auth-routes';
import { billingRoutes } from '../../core/billing-routes';
import { getTranslator } from '../../i18n';
import { useWindowRouteLocation, type BridgeRouteLocation } from '../../routing/location';
import { CallbackHandler } from '../auth/CallbackHandler';
import { AuthFormWrapper } from './shared/AuthFormWrapper';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { ForgotPassword } from './ForgotPassword';
import { MagicLink } from './MagicLink';
import { PasskeySetup } from './PasskeySetup';
import { WorkspaceSelector } from './WorkspaceSelector';

export type { BridgeAuthPage };

export interface BridgeAuthRoutesProps {
  /**
   * Everything around the form, on every page. Receives the page name and the
   * form to render. Replaces the default centred container entirely.
   */
  frame?: (page: BridgeAuthPage, children: ReactNode) => ReactNode;
  /**
   * The form heading, per page. Shown on each page's main step only — the
   * login credentials step, the signup form, the set-password form — so it
   * never stacks above a sub-step's own heading ("Check your email").
   */
  heading?: (page: BridgeAuthPage) => ReactNode;
  /**
   * Take over a page by passing an element: it renders instead of Bridge's
   * page, without the frame. Every other page keeps working. For the
   * email-link pages pass a function to receive the token:
   * `pages={{ 'set-password': ({ token }) => <MyReset token={token} /> }}`.
   */
  pages?: Partial<Record<BridgeAuthPage, ReactNode | ((route: BridgeAuthRoute) => ReactNode)>>;
  /** Rendered for an address under the mount point that names no page. */
  notFound?: ReactNode;
  /** Where a completed sign-in, passkey setup or workspace switch lands when
   *  there is no `?redirectUri=` deep link to return to. @default '/' */
  redirectTo?: string;
  /** Per-key copy overrides, passed to every form. */
  messages?: MessageOverrides;
  /**
   * The mount point, when no router adapter supplies the location — e.g.
   * `'/auth'`. Defaults to the directory of `loginRoute` (`/auth` for
   * `/auth/login`), else `/auth`.
   */
  base?: string;
  /**
   * The current location, from a router adapter. The `/react-router` and
   * `/tanstack-router` entries pass it; leave it out to read `window.location`.
   */
  location?: BridgeRouteLocation;
}

function defaultBase(loginRoute: string | null): string {
  if (loginRoute) {
    const dir = loginRoute.replace(/\/+$/, '').replace(/\/[^/]*$/, '');
    if (dir) return dir;
  }
  return '/auth';
}

export function BridgeAuthRoutes(props: BridgeAuthRoutesProps) {
  const loginRoute = useBridgeStore((s) => s.loginRoute);
  const windowLocation = useWindowRouteLocation(props.base ?? defaultBase(loginRoute));
  return <AuthRoutesBody {...props} location={props.location ?? windowLocation} />;
}

function AuthRoutesBody({
  frame,
  heading,
  pages,
  notFound,
  redirectTo = '/',
  messages,
  location,
}: BridgeAuthRoutesProps & { location: BridgeRouteLocation }) {
  const t = getTranslator(messages);
  const loginRoute = useBridgeStore((s) => s.loginRoute);
  const isAuthenticated = useBridgeStore((s) => !!s.tokens?.accessToken);

  const rest = location.rest;
  const route = parseBridgeAuthRoute(rest);
  const base = bridgeAuthBase(location.pathname, rest);
  const loginHref = `${base}/login`;
  const signupHref = `${base}/signup`;
  // Hosted mode is "no loginRoute" — the same switch <ProtectedRoute> uses.
  const hosted = !loginRoute;

  const afterSignIn = () => location.navigate(readReturnTo(location.search) ?? redirectTo);

  // A magic link returns to the page it was requested from. <MagicLink> redeems
  // it but has no `onLogin`, so the sign-in it completes is picked up here.
  // Only a transition counts: a user already signed in when the page opened is
  // not bounced away.
  const wasAuthenticated = useRef(isAuthenticated);
  useEffect(() => {
    if (isAuthenticated && !wasAuthenticated.current && route?.page === 'magic-link') afterSignIn();
    wasAuthenticated.current = isAuthenticated;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, route?.page]);

  // The workspace list needs a session. A signed-out visitor is sent to sign
  // in and back.
  useEffect(() => {
    if (route?.page === 'workspaces' && !hosted && !isAuthenticated) {
      location.navigate(withReturnTo(loginHref, `${location.pathname}${location.search}`), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.page, hosted, isAuthenticated, loginHref]);

  if (!route) {
    if (rest === null) return null; // not under the mount point: nothing to serve
    return (
      <div data-bridge-auth-route="not-found" style={{ display: 'contents' }}>
        {notFound ?? <p className="bridge-auth-not-found">Page not found.</p>}
      </div>
    );
  }

  const page = route.page;

  // Rung 3: the app's own element owns the page outright.
  if (pages && pages[page] !== undefined) {
    return (
      <div data-bridge-auth-route={page} data-bridge-auth-page-owner="app" style={{ display: 'contents' }}>
        {(() => {
          const own = pages[page];
          return typeof own === 'function' ? own(route) : own;
        })()}
      </div>
    );
  }

  // The OAuth callback exchanges the code and navigates on; it has no form.
  // In hosted mode it is the one page that is not hosted.
  if (page === 'oauth-callback') {
    return (
      <div data-bridge-auth-route={page} style={{ display: 'contents' }}>
        <CallbackHandler
          successRoute={redirectTo}
          loginRoute={hosted ? redirectTo : loginHref}
          paymentErrorRoute={billingRoutes().paymentErrorRoute}
        />
      </div>
    );
  }

  const headingSlot = heading ? heading(page) : undefined;

  let body: ReactNode = null;
  if (hosted && !(page === 'workspaces' && isAuthenticated)) {
    // Hosted mode: every sign-in page points at the hosted login instead. A
    // signed-in user switching workspace is not signing in, so that stays.
    let href: string | null = null;
    try {
      const auth = getBridgeAuth();
      href = page === 'signup' ? auth.createSignupUrl() : auth.createLoginUrl();
    } catch {
      href = null;
    }
    body = (
      <AuthFormWrapper
        heading={t(page === 'signup' ? 'signup.heading' : 'login.heading')}
        headingSlot={headingSlot}
        data-bridge-auth-hosted
      >
        <p className="bridge-step-desc">Sign-in for this app happens on its hosted login page, not here.</p>
        {href ? (
          <a className="bridge-btn bridge-btn-primary" href={href}>
            {t(page === 'signup' ? 'signup.submit' : 'login.submit')}
          </a>
        ) : null}
      </AuthFormWrapper>
    );
  } else if (page === 'login') {
    body = <LoginForm headingSlot={headingSlot} signupHref={signupHref} onLogin={afterSignIn} messages={messages} />;
  } else if (page === 'signup') {
    body = <SignupForm showLoginLink loginHref={loginHref} headingSlot={headingSlot} messages={messages} />;
  } else if (page === 'set-password') {
    body = <ForgotPassword token={route.token} loginHref={loginHref} headingSlot={headingSlot} messages={messages} />;
  } else if (page === 'forgot-password') {
    body = <ForgotPassword loginHref={loginHref} headingSlot={headingSlot} messages={messages} />;
  } else if (page === 'magic-link') {
    body = <MagicLink loginHref={loginHref} headingSlot={headingSlot} messages={messages} />;
  } else if (page === 'setup-passkey' && route.token) {
    body = (
      <PasskeySetup
        key={route.token}
        token={route.token}
        loginHref={loginHref}
        headingSlot={headingSlot}
        // Its success view links to sign-in ("Sign in now"); an expired link
        // goes back to sign-in, where a new one can be requested.
        onExpired={() => location.navigate(loginHref)}
        messages={messages}
      />
    );
  } else if (page === 'workspaces' && isAuthenticated) {
    body = (
      <AuthFormWrapper heading={t('tenant.chooseHeading')} headingSlot={headingSlot}>
        <WorkspaceSelector
          onSwitch={() => location.navigate(readReturnTo(location.search) ?? redirectTo)}
          messages={messages}
        />
      </AuthFormWrapper>
    );
  }

  return (
    <div data-bridge-auth-route={page} style={{ display: 'contents' }}>
      {frame ? frame(page, body) : <div className="bridge-auth-page">{body}</div>}
    </div>
  );
}

export default BridgeAuthRoutes;

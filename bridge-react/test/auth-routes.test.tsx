/**
 * TBP-743 — a router-agnostic `<BridgeAuthRoutes>` with adapters for React
 * Router and TanStack Router, where a page is taken over by passing an element.
 *
 * Every page is driven through a real router (React Router's MemoryRouter, a
 * TanStack memory-history router) or, with no router, `window.location`.
 * Revert-proof: none of `BridgeAuthRoutes`, `/react-router` or
 * `/tanstack-router` exists on origin/main, so the whole file fails to load there.
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { BridgeAuthRoutes } from '../src/components/sdk-auth/BridgeAuthRoutes';
import { BridgeAuthRoutes as ReactRouterAuthRoutes } from '../src/react-router';
import { BridgeAuthRoutes as TanStackAuthRoutes } from '../src/tanstack-router';
import { bridgeAuthBase, parseBridgeAuthRoute, restBelow } from '../src/core/auth-routes';
import { _resetBridgeInstance, initBridge, setBridgeConfig, useBridgeStore } from '../src/core/bridge-instance';
import { getRouterAdapter, resetRouterAdapter } from '../src/utils/router-adapter';

let originalFetch: typeof fetch;
let originalLocation: Location;

// Other files in the suite stand a plain object in for window.location, so a
// happy-dom history change would not reach it; do the same here.
function goTo(path: string): void {
  const u = new URL(path, 'http://localhost');
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { href: u.href, origin: u.origin, pathname: u.pathname, search: u.search, hash: u.hash, assign() {}, replace() {} },
  });
}

function boot(loginRoute: string | null = '/auth/login') {
  _resetBridgeInstance();
  const config = { appId: 'tbp-743', apiBaseUrl: 'http://api.test.local', ...(loginRoute ? { loginRoute } : {}) };
  initBridge(config as never);
  setBridgeConfig(config as never);
}

let warn: { mockRestore(): void };

beforeEach(() => {
  // The offline app-config read logs a warning per render; not under test.
  warn = spyOn(console, 'warn').mockImplementation(() => {});
  originalLocation = window.location;
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('{}', { status: 404 })) as unknown as typeof fetch;
  boot();
});

afterEach(() => {
  cleanup();
  warn.mockRestore();
  globalThis.fetch = originalFetch;
  resetRouterAdapter();
  _resetBridgeInstance();
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
});

const routeOf = (c: HTMLElement) => c.querySelector('[data-bridge-auth-route]')?.getAttribute('data-bridge-auth-route');

describe('parseBridgeAuthRoute', () => {
  it('serves the guide pages plus workspaces and the OAuth callback', () => {
    for (const page of ['login', 'signup', 'oauth-callback', 'forgot-password', 'magic-link', 'workspaces']) {
      expect(parseBridgeAuthRoute(page)).toEqual({ page } as never);
    }
  });

  it('reads the email-link token — the signup verification address', () => {
    expect(parseBridgeAuthRoute('set-password/abc123')).toEqual({ page: 'set-password', token: 'abc123' });
    expect(parseBridgeAuthRoute('setup-passkey/t%2Fk')).toEqual({ page: 'setup-passkey', token: 't/k' });
  });

  it('refuses half-matches, so they are not found instead of rendering a form', () => {
    expect(parseBridgeAuthRoute('login/extra')).toBeNull();
    expect(parseBridgeAuthRoute('set-password')).toBeNull();
    expect(parseBridgeAuthRoute('nope')).toBeNull();
    expect(parseBridgeAuthRoute('')).toBeNull();
  });

  it('finds the mount point from the path and the rest', () => {
    expect(bridgeAuthBase('/auth/login', 'login')).toBe('/auth');
    expect(bridgeAuthBase('/app/sign/set-password/x', 'set-password/x')).toBe('/app/sign');
    expect(restBelow('/auth/signup', '/auth')).toBe('signup');
    expect(restBelow('/dashboard', '/auth')).toBeNull();
  });
});

// ── React Router ─────────────────────────────────────────────────────────────

function LocationProbe() {
  const loc = useLocation();
  return <output data-testid="loc">{`${loc.pathname}${loc.search}`}</output>;
}

function reactRouterApp(path: string, element = <ReactRouterAuthRoutes />) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/auth/*" element={element} />
        <Route path="*" element={<p>app page</p>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('React Router adapter', () => {
  it('<Route path="/auth/*"> serves the login page', async () => {
    const { container } = reactRouterApp('/auth/login');
    expect(routeOf(container)).toBe('login');
    await waitFor(() => expect(container.querySelector('input[type="email"]')).not.toBeNull());
    // The signup link is built from where the route is mounted.
    expect(container.querySelector('a[href="/auth/signup"]')).not.toBeNull();
  });

  it('serves the set-password page an emailed link lands on, with its token', () => {
    const { container } = reactRouterApp('/auth/set-password/tok-1');
    expect(routeOf(container)).toBe('set-password');
    expect(container.querySelector('[data-bridge-auth-form]')).not.toBeNull();
  });

  it('an unknown page under the mount point is not found — no form', () => {
    const { container } = reactRouterApp('/auth/nope');
    expect(routeOf(container)).toBe('not-found');
    expect(container.querySelector('[data-bridge-auth-form]')).toBeNull();
  });

  it('a page is taken over by passing an element; every other page keeps working', () => {
    const custom = <ReactRouterAuthRoutes pages={{ login: <h1 data-testid="mine">My login</h1> }} />;
    const mine = reactRouterApp('/auth/login', custom);
    expect(mine.getByTestId('mine').textContent).toBe('My login');
    expect(mine.container.querySelector('[data-bridge-auth-form]')).toBeNull();
    cleanup();
    const other = reactRouterApp('/auth/forgot-password', custom);
    expect(routeOf(other.container)).toBe('forgot-password');
    expect(other.container.querySelector('[data-bridge-auth-form]')).not.toBeNull();
  });

  it('an email-link page taken over by a function receives its token', () => {
    const { getByTestId } = reactRouterApp(
      '/auth/set-password/tok-7',
      <ReactRouterAuthRoutes pages={{ 'set-password': ({ token }) => <p data-testid="mine">{token}</p> }} />,
    );
    expect(getByTestId('mine').textContent).toBe('tok-7');
  });

  it('frame and heading customise every page without taking one over', async () => {
    const { container } = reactRouterApp(
      '/auth/signup',
      <ReactRouterAuthRoutes
        frame={(page, children) => <main data-frame={page}>{children}</main>}
        heading={(page) => <h1 data-heading>{page === 'signup' ? 'Create your account' : 'Welcome back'}</h1>}
      />,
    );
    expect(container.querySelector('main[data-frame="signup"] [data-bridge-auth-form]')).not.toBeNull();
    // The default centred container is replaced, not wrapped.
    expect(container.querySelector('.bridge-auth-page')).toBeNull();
    expect(container.querySelector('[data-heading]')?.textContent).toBe('Create your account');
    // The heading replaces the built-in one: exactly one heading on the page.
    expect(container.querySelectorAll('h1, h2').length).toBe(1);
  });

  it('navigates in-app with the router: a signed-out visit to workspaces goes to login and back', async () => {
    const { container, getByTestId } = reactRouterApp('/auth/workspaces');
    await waitFor(() => expect(getByTestId('loc').textContent).toBe('/auth/login?redirectUri=%2Fauth%2Fworkspaces'));
    expect(routeOf(container)).toBe('login');
  });

  it('registers React Router as the SDK router adapter, so other Bridge navigation is in-app', async () => {
    const { getByTestId } = reactRouterApp('/auth/login');
    act(() => getRouterAdapter().navigate('/somewhere'));
    await waitFor(() => expect(getByTestId('loc').textContent).toBe('/somewhere'));
  });

  it('hosted mode (no loginRoute): the pages point at the hosted login instead of a form', () => {
    boot(null);
    const { container } = reactRouterApp('/auth/login');
    expect(container.querySelector('[data-bridge-auth-hosted]')).not.toBeNull();
    expect(container.querySelector('input[type="password"]')).toBeNull();
  });
});

// ── TanStack Router ──────────────────────────────────────────────────────────

function tanstackApp(path: string) {
  const rootRoute = createRootRoute();
  const authRoute = createRoute({ getParentRoute: () => rootRoute, path: 'auth/$', component: TanStackAuthRoutes });
  const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => <p>home</p> });
  const router = createRouter({
    routeTree: rootRoute.addChildren([authRoute, homeRoute]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const view = render(<RouterProvider router={router} />);
  return { ...view, router };
}

describe('TanStack Router adapter', () => {
  it('an `auth/$` route serves the login page', async () => {
    const { container } = tanstackApp('/auth/login');
    await waitFor(() => expect(routeOf(container)).toBe('login'));
    expect(container.querySelector('a[href="/auth/signup"]')).not.toBeNull();
  });

  it('reads the email-link token from the splat', async () => {
    const { container } = tanstackApp('/auth/setup-passkey/pk-1');
    await waitFor(() => expect(routeOf(container)).toBe('setup-passkey'));
  });

  it('navigates in-app through the router history, keeping the query', async () => {
    const { container, router } = tanstackApp('/auth/workspaces');
    await waitFor(() => expect(router.state.location.pathname).toBe('/auth/login'));
    expect(router.state.location.href).toBe('/auth/login?redirectUri=%2Fauth%2Fworkspaces');
    await waitFor(() => expect(routeOf(container)).toBe('login'));
  });
});

// ── No router ────────────────────────────────────────────────────────────────

describe('without a router', () => {
  it('reads window.location below the mount point (the directory of loginRoute)', () => {
    goTo('/auth/magic-link');
    const { container } = render(<BridgeAuthRoutes />);
    expect(routeOf(container)).toBe('magic-link');
  });

  it('renders nothing for a path that is not under the mount point', () => {
    goTo('/dashboard');
    const { container } = render(<BridgeAuthRoutes />);
    expect(container.innerHTML).toBe('');
  });

  it('a magic-link sign-in completing on the page lands on redirectTo', async () => {
    goTo('/auth/magic-link');
    const navigations: string[] = [];
    render(
      <BridgeAuthRoutes
        redirectTo="/home"
        location={{
          pathname: '/auth/magic-link',
          search: '',
          rest: 'magic-link',
          navigate: (to) => navigations.push(to),
        }}
      />,
    );
    act(() => useBridgeStore.setState({ tokens: { accessToken: 'a', refreshToken: 'r', idToken: 'i' } }));
    await waitFor(() => expect(navigations).toEqual(['/home']));
  });
});

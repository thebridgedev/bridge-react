/**
 * Deep-link preservation for <ProtectedRoute> (TBP-629).
 *
 * The bug being guarded against is silent: an unauthenticated visitor following
 * a link into a protected screen is sent to login, signs in, and lands on the
 * app's default route with no error and no trace of the URL they followed. It
 * reads as a broken feature rather than a routing default, which is why every
 * assertion here checks the DESTINATION and not merely that a redirect happened.
 */
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { render, cleanup, waitFor } from '@testing-library/react';
import { ProtectedRoute } from '../src/components/auth/ProtectedRoute';
import {
  initBridge,
  getBridgeAuth,
  setBridgeConfig,
  useBridgeStore,
  _resetBridgeInstance,
} from '../src/core/bridge-instance';
import { setRouterAdapter, resetRouterAdapter } from '../src/utils/router-adapter';
import { RETURN_TO_STORAGE_KEY, takeReturnTo } from '@nebulr-group/bridge-auth-core';
import type { BridgeConfig } from '../src/types/config';

const HOSTED_URL = 'https://auth.thebridge.dev/login?app=test';

function primeUnauthenticated(loginRoute: string | null) {
  useBridgeStore.setState({ tokens: null, isLoading: false, loginRoute });
}

/** Render <ProtectedRoute> and return where it sent the visitor. */
async function redirectTargetFor(
  attemptedPath: string,
  config: Partial<BridgeConfig>,
  navigateSpy: ReturnType<typeof mock>,
) {
  setRouterAdapter({
    navigate: navigateSpy as any,
    replace: mock(() => {}) as any,
    getCurrentPath: () => attemptedPath,
  });
  setBridgeConfig({ appId: 'test-app', ...config } as BridgeConfig);
  primeUnauthenticated(config.loginRoute ?? null);

  render(
    <ProtectedRoute>
      <div>secret</div>
    </ProtectedRoute>,
  );
  return navigateSpy;
}

describe('SDK mode — the attempted path rides on the login URL', () => {
  let navigateSpy: ReturnType<typeof mock>;

  beforeEach(() => {
    _resetBridgeInstance();
    initBridge({ appId: 'test-app' } as any);
    (getBridgeAuth() as any).createLoginUrl = () => HOSTED_URL;
    navigateSpy = mock(() => {});
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    resetRouterAdapter();
    _resetBridgeInstance();
    sessionStorage.clear();
  });

  it('carries the deep link the visitor asked for', async () => {
    await redirectTargetFor('/incident/42', { loginRoute: '/auth/login' }, navigateSpy);

    await waitFor(() => expect(navigateSpy).toHaveBeenCalledTimes(1));
    expect(navigateSpy).toHaveBeenCalledWith('/auth/login?redirectUri=%2Fincident%2F42');
  });

  it('does not send the login route back to itself', async () => {
    // A bounce through the login page must not come back pointing at it, which
    // either loops or strands the visitor on a page that re-redirects.
    await redirectTargetFor('/auth/login', { loginRoute: '/auth/login' }, navigateSpy);

    await waitFor(() => expect(navigateSpy).toHaveBeenCalledTimes(1));
    expect(navigateSpy).toHaveBeenCalledWith('/auth/login');
  });

  it('honours an exclusion pattern', async () => {
    await redirectTargetFor(
      '/auth/callback',
      { loginRoute: '/auth/login', returnTo: { exclude: [new RegExp('^/auth($|/)')] } },
      navigateSpy,
    );

    await waitFor(() => expect(navigateSpy).toHaveBeenCalledTimes(1));
    expect(navigateSpy).toHaveBeenCalledWith('/auth/login');
  });

  it('keeps today’s behaviour exactly when opted out', async () => {
    await redirectTargetFor(
      '/incident/42',
      { loginRoute: '/auth/login', returnTo: { enabled: false } },
      navigateSpy,
    );

    await waitFor(() => expect(navigateSpy).toHaveBeenCalledTimes(1));
    expect(navigateSpy).toHaveBeenCalledWith('/auth/login');
  });

  it('respects a custom parameter name', async () => {
    await redirectTargetFor(
      '/incident/42',
      { loginRoute: '/auth/login', returnTo: { param: 'next' } },
      navigateSpy,
    );

    await waitFor(() => expect(navigateSpy).toHaveBeenCalledTimes(1));
    expect(navigateSpy).toHaveBeenCalledWith('/auth/login?next=%2Fincident%2F42');
  });

  it('preserves a login route that already carries a query', async () => {
    await redirectTargetFor(
      '/incident/42',
      { loginRoute: '/auth/login?tenant=acme' },
      navigateSpy,
    );

    await waitFor(() => expect(navigateSpy).toHaveBeenCalledTimes(1));
    expect(navigateSpy).toHaveBeenCalledWith(
      '/auth/login?tenant=acme&redirectUri=%2Fincident%2F42',
    );
  });
});

describe('hosted mode — the attempted path goes to storage, never the URL', () => {
  let navigateSpy: ReturnType<typeof mock>;

  beforeEach(() => {
    _resetBridgeInstance();
    initBridge({ appId: 'test-app' } as any);
    (getBridgeAuth() as any).createLoginUrl = () => HOSTED_URL;
    navigateSpy = mock(() => {});
    sessionStorage.clear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, href: 'http://localhost/', search: '' },
    });
  });

  afterEach(() => {
    cleanup();
    resetRouterAdapter();
    _resetBridgeInstance();
    sessionStorage.clear();
  });

  it('stashes the deep link and leaves the OAuth URL byte-for-byte untouched', async () => {
    await redirectTargetFor('/incident/42', {}, navigateSpy);

    await waitFor(() => expect(window.location.href).toBe(HOSTED_URL));
    // The load-bearing assertion. bridge-api validates `redirect_uri` with an
    // exact `allowedRedirectUris.includes()` match, so appending anything to the
    // hosted login URL breaks login outright rather than improving it.
    expect(window.location.href).not.toContain('redirectUri=%2Fincident');
    expect(sessionStorage.getItem(RETURN_TO_STORAGE_KEY)).toBe('/incident/42');
  });

  it('stashes nothing when opted out', async () => {
    await redirectTargetFor('/incident/42', { returnTo: { enabled: false } }, navigateSpy);

    await waitFor(() => expect(window.location.href).toBe(HOSTED_URL));
    expect(sessionStorage.getItem(RETURN_TO_STORAGE_KEY)).toBeNull();
  });

  it('hands the stashed value over exactly once', async () => {
    await redirectTargetFor('/incident/42', {}, navigateSpy);
    await waitFor(() => expect(sessionStorage.getItem(RETURN_TO_STORAGE_KEY)).toBe('/incident/42'));

    // One-shot by design: a value left behind would hijack the NEXT login in
    // this tab, sending somebody to a page they asked for ten minutes ago.
    expect(takeReturnTo()).toBe('/incident/42');
    expect(takeReturnTo()).toBeNull();
  });
});

describe('hostile return targets never reach a navigation call', () => {
  let navigateSpy: ReturnType<typeof mock>;

  beforeEach(() => {
    _resetBridgeInstance();
    initBridge({ appId: 'test-app' } as any);
    (getBridgeAuth() as any).createLoginUrl = () => HOSTED_URL;
    navigateSpy = mock(() => {});
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    resetRouterAdapter();
    _resetBridgeInstance();
    sessionStorage.clear();
  });

  // The value is attacker-controllable in SDK mode — whoever writes the link
  // chooses it. Navigating to it unchecked is an open redirect that still looks
  // like it came from the app, which is where phishing starts.
  const hostile = [
    ['an absolute URL', 'https://evil.test/x'],
    ['a protocol-relative URL', '//evil.test/x'],
    ['the backslash spelling of protocol-relative', '/\\evil.test'],
    ['a backslash anywhere', '/a\\b'],
    ['a relative path', 'incident/42'],
  ] as const;

  for (const [label, value] of hostile) {
    it(`rejects ${label}`, async () => {
      await redirectTargetFor(value, { loginRoute: '/auth/login' }, navigateSpy);

      await waitFor(() => expect(navigateSpy).toHaveBeenCalledTimes(1));
      // Rejected outright rather than repaired: a value we have to fix up is a
      // value we do not understand.
      expect(navigateSpy).toHaveBeenCalledWith('/auth/login');
    });
  }
});

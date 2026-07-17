import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { render, cleanup, waitFor } from '@testing-library/react';
import { ProtectedRoute } from '../src/components/auth/ProtectedRoute';
import {
  initBridge,
  getBridgeAuth,
  useBridgeStore,
  _resetBridgeInstance,
} from '../src/core/bridge-instance';
import { setRouterAdapter, resetRouterAdapter } from '../src/utils/router-adapter';

// Puts the store into an unauthenticated, resolved state (isLoading=false,
// no tokens) so <ProtectedRoute>'s redirect effect fires.
function primeUnauthenticated(loginRoute: string | null) {
  useBridgeStore.setState({
    tokens: null,
    isLoading: false,
    loginRoute,
  });
}

describe('ProtectedRoute redirect target (TBP-478)', () => {
  const HOSTED_URL = 'https://auth.thebridge.dev/login?app=test';
  let navigateSpy: ReturnType<typeof mock>;
  let originalHref: string;

  beforeEach(() => {
    _resetBridgeInstance();
    // A BridgeAuth singleton is required because useAuth().login() calls
    // getBridgeAuth().createLoginUrl(). We stub createLoginUrl so the hosted
    // branch is observable without a network round-trip.
    initBridge({ appId: 'test-app' } as any);
    (getBridgeAuth() as any).createLoginUrl = () => HOSTED_URL;

    navigateSpy = mock(() => {});
    setRouterAdapter({
      navigate: navigateSpy as any,
      replace: mock(() => {}) as any,
      getCurrentPath: () => '/protected',
    });

    // Track hosted redirects via window.location.href without navigating jsdom.
    originalHref = window.location.href;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, href: originalHref },
    });
  });

  afterEach(() => {
    cleanup();
    resetRouterAdapter();
    _resetBridgeInstance();
  });

  it('navigates to the in-app loginRoute via the router adapter when loginRoute is set (SDK mode)', async () => {
    primeUnauthenticated('/sign-in');

    render(
      <ProtectedRoute>
        <div>secret</div>
      </ProtectedRoute>
    );

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalledTimes(1);
    });
    expect(navigateSpy).toHaveBeenCalledWith('/sign-in');
    // Hosted portal must NOT be used.
    expect(window.location.href).toBe(originalHref);
  });

  it('launches the hosted auth portal when loginRoute is unset (default/hosted mode)', async () => {
    primeUnauthenticated(null);

    render(
      <ProtectedRoute>
        <div>secret</div>
      </ProtectedRoute>
    );

    await waitFor(() => {
      expect(window.location.href).toBe(HOSTED_URL);
    });
    // In-app router adapter must NOT be used.
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});

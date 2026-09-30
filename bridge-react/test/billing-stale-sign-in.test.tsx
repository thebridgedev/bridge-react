/**
 * TBP-762 — every billing read the plugin makes renews an out-of-date sign-in.
 *
 * Regression: right after a checkout Bridge bumps the workspace's token
 * version, so the access token the page holds is out of date until the next
 * refresh. A billing read in that window answered `401 TOKEN_VERSION_STALE`,
 * and <BridgeSubscriptionStatus> / <BridgeBillingNotice> showed "Subscription
 * unavailable" (or nothing) until a reload. The quota store had the same gap.
 *
 * auth-core 0.8 retries such a read once when the caller passes
 * `onTokenStale` (`bridgeAuth.tokenStaleHandler()`, which mints a FRESH token).
 * These tests fake only the network and the refresh.
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { cleanup, render, waitFor } from '@testing-library/react';
import { useBridge } from '@nebulr-group/bridge-auth-core';
import { BridgeSubscriptionStatus } from '../src/components/subscription/BridgeSubscriptionStatus';
import { BridgeBillingNotice } from '../src/components/subscription/BridgeBillingNotice';
import { _resetBridgeInstance, getBridgeAuth, initBridge } from '../src/core/bridge-instance';
import { __resetBridgeRuntime, tokenStaleHandler } from '../src/core/bridge-runtime';
import { createBridgeFlags } from '../src/flags/bootstrap';

const API = 'http://api.test.local';
const STALE = 'tok-stale';
const FRESH = 'tok-fresh';
const PAST_DUE = { plan: { slug: 'pro', name: 'Pro' }, status: 'past_due' };

/** Authorization header of every /billing/state request, in order. */
let billingAuth: string[];
let refreshOptions: Array<{ fresh?: boolean } | undefined>;
let originalFetch: typeof fetch;
const spies: Array<{ mockRestore(): void }> = [];

beforeEach(() => {
  __resetBridgeRuntime();
  _resetBridgeInstance();
  initBridge({ appId: 'app-1', apiBaseUrl: API } as never);
  billingAuth = [];
  refreshOptions = [];
  useBridge().subscription.hydrate(null as never); // no billing read yet

  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const auth = String(((init?.headers ?? {}) as Record<string, string>).Authorization ?? '');
    if (url.pathname === '/billing/state') {
      billingAuth.push(auth);
      // Bridge refuses the out-of-date token and accepts the fresh one.
      if (auth === `Bearer ${STALE}`) {
        return new Response(JSON.stringify({ code: 'TOKEN_VERSION_STALE', message: 'refresh required' }), { status: 401 });
      }
      return new Response(JSON.stringify(PAST_DUE), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;

  const auth = getBridgeAuth();
  spies.push(
    spyOn(auth, 'getApiContext').mockImplementation((() => ({ apiBaseUrl: API, appId: 'app-1', accessToken: STALE })) as never),
    spyOn(auth, 'refreshTokens').mockImplementation((async (options?: { fresh?: boolean }) => {
      refreshOptions.push(options);
      return { accessToken: FRESH, refreshToken: 'r' };
    }) as never),
    spyOn(auth, 'canManageBilling').mockImplementation((() => true) as never),
  );
});

afterEach(() => {
  cleanup();
  for (const spy of spies.splice(0)) spy.mockRestore();
  globalThis.fetch = originalFetch;
  __resetBridgeRuntime();
  _resetBridgeInstance();
});

describe('billing reads renew an out-of-date sign-in (TBP-762)', () => {
  it('tokenStaleHandler() mints a FRESH token (never joins an in-flight refresh)', async () => {
    const handler = tokenStaleHandler();
    expect(handler).toBeFunction();
    await expect(handler!()).resolves.toBe(FRESH);
    expect(refreshOptions).toEqual([{ fresh: true }]);
  });

  it('<BridgeSubscriptionStatus> retries a TOKEN_VERSION_STALE read with the fresh token and shows the plan', async () => {
    const { container } = render(<BridgeSubscriptionStatus />);
    await waitFor(() => expect(container.querySelector('.bss-plan')?.textContent).toBe('Pro'));
    expect(billingAuth).toEqual([`Bearer ${STALE}`, `Bearer ${FRESH}`]);
    expect(container.querySelector('.bss-error')).toBeNull();
  });

  it('<BridgeBillingNotice> retries too, so the notice for a past-due plan appears', async () => {
    render(<BridgeBillingNotice />);
    await waitFor(() => expect(useBridge().subscription.snapshot().state?.status).toBe('past_due'));
    expect(billingAuth).toEqual([`Bearer ${STALE}`, `Bearer ${FRESH}`]);
  });

  it('the flags bootstrap configures the quota store with the handler', async () => {
    const configure = spyOn(useBridge().quotas, 'configure');
    spies.push(configure);
    const flags = createBridgeFlags({ registerGlobal: false } as never);
    try {
      const opts = configure.mock.calls[0]?.[0] as { onTokenStale?: unknown } | undefined;
      expect(opts?.onTokenStale).toBeFunction();
    } finally {
      await flags.stop(); // its token subscription must not outlive this test
    }
  });
});

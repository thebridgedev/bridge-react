/**
 * The Stripe return's `?redirect=` must never take the user off-origin.
 *
 * Regression: <CallbackHandler> passed `params.get('redirect')` straight to the
 * router adapter, whose default navigates with `window.location.replace`. A
 * crafted `/auth/oauth-callback?stripe_cancel=1&redirect=https://evil.test`
 * link bounced the user off-site from our own origin. Same defect as
 * bridge-svelte's BridgeBootstrap Stripe callback (found in the PR #56 review).
 */
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { cleanup, render, waitFor } from '@testing-library/react';
import { CallbackHandler } from '../src/components/auth/CallbackHandler';
import { _resetBridgeInstance, getBridgeAuth, initBridge } from '../src/core/bridge-instance';
import { resetRouterAdapter, setRouterAdapter } from '../src/utils/router-adapter';

let replaceSpy: ReturnType<typeof mock>;
let originalLocation: Location;
const spies: Array<{ mockRestore(): void }> = [];

function atCallback(search: string): void {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, pathname: '/auth/oauth-callback', search },
  });
}

async function landedOn(): Promise<string> {
  await waitFor(() => expect(replaceSpy).toHaveBeenCalledTimes(1));
  return replaceSpy.mock.calls[0][0] as string;
}

const HOSTILE: Array<[string, string]> = [
  ['absolute URL', 'https://evil.test'],
  ['protocol-relative', '//evil.test'],
  ['backslash protocol-relative', '/\\evil.test'],
  ['javascript: scheme', 'javascript:alert(1)'],
  ['encoded protocol-relative', '%2F%2Fevil.test'],
];

describe('<CallbackHandler> Stripe return redirect stays on origin', () => {
  beforeEach(() => {
    _resetBridgeInstance();
    initBridge({ appId: 'test-app' } as never);
    spies.push(
      spyOn(getBridgeAuth(), 'confirmStripeCheckout').mockImplementation((async () => undefined) as never),
    );
    originalLocation = window.location;
    replaceSpy = mock(() => {});
    setRouterAdapter({
      navigate: mock(() => {}) as never,
      replace: replaceSpy as never,
      getCurrentPath: () => '/auth/oauth-callback',
    });
  });

  afterEach(() => {
    cleanup();
    for (const spy of spies.splice(0)) spy.mockRestore();
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    resetRouterAdapter();
    _resetBridgeInstance();
  });

  for (const [label, value] of HOSTILE) {
    it(`cancel: rejects ${label} (${value}) and falls back to the default`, async () => {
      atCallback(`?stripe_cancel=1&redirect=${encodeURIComponent(value)}`);
      render(<CallbackHandler />);
      expect(await landedOn()).toBe('/subscription');
    });
  }

  it('cancel: rejects a raw, unencoded protocol-relative value', async () => {
    atCallback('?stripe_cancel=1&redirect=//evil.test');
    render(<CallbackHandler />);
    expect(await landedOn()).toBe('/subscription');
  });

  it('success: rejects an absolute URL after confirming the checkout', async () => {
    atCallback(`?stripe_success=1&session_id=cs_1&redirect=${encodeURIComponent('https://evil.test/x')}`);
    render(<CallbackHandler />);
    expect(await landedOn()).toBe('/subscription');
  });

  it('keeps a same-origin path (query stripped, as before)', async () => {
    atCallback(`?stripe_success=1&session_id=cs_1&redirect=${encodeURIComponent('/billing?x=1')}`);
    render(<CallbackHandler />);
    expect(await landedOn()).toBe('/billing');
  });

  it('no redirect param → the default, unchanged', async () => {
    atCallback('?stripe_cancel=1');
    render(<CallbackHandler />);
    expect(await landedOn()).toBe('/subscription');
  });
});

/**
 * Regression (TBP-723): a customer returning from a completed Stripe checkout
 * was sent to the paywall (`/welcome`) ~20 ms after bootstrap, and that
 * navigation aborted <CallbackHandler>'s `confirmStripeCheckout`.
 *
 * auth-core's `shouldRedirectToPaywall()` reads the `shouldSelectPlan` claim
 * off the current access token (TBP-368). On the Stripe return that token
 * predates the payment, so the claim still says "select a plan" until the
 * confirmation has refreshed it. <BridgeProvider>'s mount-time paywall effect
 * checked it straight away. bridge-svelte never hit this: its bootstrap
 * confirms the checkout on the callback route first and enforces the paywall
 * after. These tests pin the same order for React.
 *
 * Real provider, real <CallbackHandler>, real auth-core `BridgeAuth` including
 * its real `confirmStripeCheckout` and `shouldRedirectToPaywall`. Faked: the
 * network (confirm-checkout lands when the test says so), the token refresh
 * (mints a token whose claim reflects whether the server has recorded the
 * payment), and the router adapter (records every navigation).
 */
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import { BridgeAuth } from '@nebulr-group/bridge-auth-core';
import { BridgeProvider } from '../src/providers/bridge-provider';
import { CallbackHandler } from '../src/components/auth/CallbackHandler';
import { _resetBridgeInstance, confirmCheckout, initBridge } from '../src/core/bridge-instance';
import { __resetBridgeRuntime } from '../src/core/bridge-runtime';
import { resetRouterAdapter, setRouterAdapter } from '../src/utils/router-adapter';

const ORIGIN = 'http://localhost';
const PAYWALL = '/welcome';
const CONFIG = { billing: { paywallRoute: PAYWALL } };
const STRIPE_RETURN = `/auth/oauth-callback?stripe_success=1&session_id=cs_1&redirect=${encodeURIComponent('/dashboard')}`;

// ── Fake backend ────────────────────────────────────────────────────────────

/** What the server knows: has the checkout been confirmed (plan recorded)? */
let serverHasPayment: boolean;
/** Whether an accepted confirm-checkout actually records the plan server-side. */
let confirmRecordsPlan: boolean;
/** The `shouldSelectPlan` claim on the access token the client holds now. */
let tokenSaysSelectPlan: boolean;
/** Ordered log of what happened, to assert sequencing. */
let events: string[];
let releaseConfirm: (ok: boolean) => void;
let confirmRequested: Promise<void>;

let replaceSpy: ReturnType<typeof mock>;
let originalFetch: typeof fetch;
const spies: Array<{ mockRestore(): void }> = [];

// Same pattern as the other files in this suite: stand a plain location object
// in for window.location (several of them leave theirs in place, so a
// happy-dom URL change would not reach `window.location` here).
let originalLocation: Location;
function goTo(path: string): void {
  const u = new URL(path, ORIGIN);
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      href: u.href,
      origin: u.origin,
      protocol: u.protocol,
      host: u.host,
      hostname: u.hostname,
      port: u.port,
      pathname: u.pathname,
      search: u.search,
      hash: u.hash,
      assign() {},
      replace() {},
      reload() {},
      toString: () => u.href,
    },
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function until(cond: () => boolean, ms = 1000): Promise<void> {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error('timed out waiting for condition');
    await sleep(5);
  }
}

const navigations = () => replaceSpy.mock.calls.map((c) => c[0] as string);

beforeEach(() => {
  originalLocation = window.location;
  serverHasPayment = false;
  confirmRecordsPlan = true;
  tokenSaysSelectPlan = true; // the token minted before the customer paid
  events = [];

  let signalRequested!: () => void;
  confirmRequested = new Promise<void>((r) => (signalRequested = r));
  const confirmResponse = new Promise<boolean>((r) => (releaseConfirm = r));

  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL) => {
    const url = String(input);
    if (url.endsWith('/v1/account/stripe/confirm-checkout')) {
      events.push('confirm:requested');
      signalRequested();
      const ok = await confirmResponse;
      if (ok && confirmRecordsPlan) serverHasPayment = true;
      events.push(`confirm:${ok ? 'ok' : 'failed'}`);
      return { ok, status: ok ? 200 : 500, json: async () => ({}) } as Response;
    }
    // Everything else (realtime config, app config, flags) is offline.
    throw new Error(`offline (unit test): ${url}`);
  }) as typeof fetch;

  const proto = BridgeAuth.prototype as unknown as Record<string, unknown>;
  spies.push(
    spyOn(proto as never, 'isAuthenticated' as never).mockImplementation((() => true) as never),
    // The token's payment claims — what TBP-368's zero-network paywall check reads.
    spyOn(proto as never, 'getPaymentClaims' as never).mockImplementation((() => {
      events.push(`claims:shouldSelectPlan=${tokenSaysSelectPlan}`);
      return { shouldSelectPlan: tokenSaysSelectPlan, paymentsAutoRedirect: true };
    }) as never),
    // A refresh mints a token that reflects the server's CURRENT billing state.
    spyOn(proto as never, 'refreshTokens' as never).mockImplementation((async () => {
      tokenSaysSelectPlan = !serverHasPayment;
      events.push(`refresh:shouldSelectPlan=${tokenSaysSelectPlan}`);
    }) as never),
    spyOn(proto as never, 'getSubscriptionStatus' as never).mockImplementation((async () => ({
      shouldSelectPlan: !serverHasPayment,
    })) as never),
    spyOn(proto as never, 'getPlans' as never).mockImplementation((async () => []) as never),
    spyOn(console, 'warn').mockImplementation(() => {}),
  );

  replaceSpy = mock((path: string) => {
    events.push(`navigate:${path}`);
  });
  setRouterAdapter({
    navigate: mock(() => {}) as never,
    replace: replaceSpy as never,
    getCurrentPath: () => window.location.pathname,
  });
});

afterEach(async () => {
  cleanup();
  releaseConfirm?.(true); // never leave a confirmation hanging across tests
  await sleep(0);
  for (const spy of spies.splice(0)) spy.mockRestore();
  globalThis.fetch = originalFetch;
  resetRouterAdapter();
  __resetBridgeRuntime();
  _resetBridgeInstance();
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
});

describe('TBP-723: Stripe checkout return vs the paywall redirect', () => {
  it('does not redirect to the paywall before confirm-checkout settles, then lands on the destination', async () => {
    goTo(STRIPE_RETURN);
    render(
      <BridgeProvider appId="test-app" config={CONFIG}>
        <CallbackHandler />
      </BridgeProvider>,
    );

    await confirmRequested;
    // Well past the ~20 ms at which the old mount-time paywall effect fired.
    await sleep(60);
    expect(navigations()).toEqual([]);

    releaseConfirm(true);
    await until(() => navigations().length > 0);
    await sleep(30); // let any straggling redirect show itself

    expect(navigations()).toEqual(['/dashboard']);
    expect(navigations()).not.toContain(PAYWALL);
  });

  it('runs the paywall check after confirmation, against the refreshed token', async () => {
    goTo(STRIPE_RETURN);
    render(
      <BridgeProvider appId="test-app" config={CONFIG}>
        <CallbackHandler />
      </BridgeProvider>,
    );

    await confirmRequested;
    releaseConfirm(true);
    await until(() => navigations().length > 0);
    await sleep(30);

    // The only paywall decision on this page reads the post-confirm token.
    const claimReads = events.filter((e) => e.startsWith('claims:'));
    expect(claimReads).toEqual(['claims:shouldSelectPlan=false']);
    const order = (e: string) => events.indexOf(e);
    expect(order('confirm:ok')).toBeLessThan(order('refresh:shouldSelectPlan=false'));
    expect(order('refresh:shouldSelectPlan=false')).toBeLessThan(order('claims:shouldSelectPlan=false'));
    expect(order('claims:shouldSelectPlan=false')).toBeLessThan(order('navigate:/dashboard'));
  });

  it('still sends the tenant to the paywall when the refreshed token says it must pick a plan', async () => {
    goTo(STRIPE_RETURN);
    // The confirm is accepted but the server has not recorded a plan.
    confirmRecordsPlan = false;
    render(
      <BridgeProvider appId="test-app" config={CONFIG}>
        <CallbackHandler />
      </BridgeProvider>,
    );

    await confirmRequested;
    await sleep(60);
    expect(navigations()).toEqual([]);

    releaseConfirm(true);
    await until(() => navigations().length > 0);
    await sleep(30);

    expect(navigations()).toEqual([PAYWALL]);
    expect(events.indexOf('confirm:ok')).toBeLessThan(events.indexOf(`navigate:${PAYWALL}`));
  });

  it('a failed confirmation goes to the payment-error route, not the paywall', async () => {
    goTo(STRIPE_RETURN);
    render(
      <BridgeProvider appId="test-app" config={CONFIG}>
        <CallbackHandler />
      </BridgeProvider>,
    );

    await confirmRequested;
    releaseConfirm(false);
    await until(() => navigations().length > 0);
    await sleep(30);

    expect(navigations()).toEqual(['/payment-error']);
  });

  it('outside the callback route the paywall still redirects on mount, as before', async () => {
    goTo('/dashboard');
    render(
      <BridgeProvider appId="test-app" config={CONFIG}>
        <div />
      </BridgeProvider>,
    );

    await until(() => navigations().length > 0);
    await sleep(30);

    expect(navigations()).toEqual([PAYWALL]);
    expect(events).not.toContain('confirm:requested');
  });

  it('outside the callback route, no redirect when the token says a plan is selected', async () => {
    goTo('/dashboard');
    serverHasPayment = true; // a paid tenant: its token (and any refresh) says no plan pick
    tokenSaysSelectPlan = false;
    render(
      <BridgeProvider appId="test-app" config={CONFIG}>
        <div />
      </BridgeProvider>,
    );

    await until(() => events.some((e) => e.startsWith('claims:')));
    await sleep(30);

    expect(navigations()).toEqual([]);
  });

  it('outside the callback route, the paywall check waits for a pending confirmation', async () => {
    goTo('/dashboard');
    initBridge({ appId: 'test-app', apiBaseUrl: 'http://api.test.local' } as never);
    const confirmation = confirmCheckout('cs_1');
    await confirmRequested;

    render(
      <BridgeProvider appId="test-app" config={CONFIG}>
        <div />
      </BridgeProvider>,
    );

    await sleep(60);
    expect(navigations()).toEqual([]);
    expect(events.some((e) => e.startsWith('claims:'))).toBe(false);

    releaseConfirm(true);
    await confirmation;
    await sleep(30);

    // Checked with the refreshed (paid) token → stays put.
    expect(events.filter((e) => e.startsWith('claims:'))).toEqual(['claims:shouldSelectPlan=false']);
    expect(navigations()).toEqual([]);
  });

  it('confirmCheckout joins an in-flight confirmation for the same session instead of posting twice', async () => {
    initBridge({ appId: 'test-app', apiBaseUrl: 'http://api.test.local' } as never);
    const a = confirmCheckout('cs_1');
    const b = confirmCheckout('cs_1');
    expect(b).toBe(a);
    await confirmRequested;
    releaseConfirm(true);
    await Promise.all([a, b]);
    expect(events.filter((e) => e === 'confirm:requested')).toHaveLength(1);
  });
});

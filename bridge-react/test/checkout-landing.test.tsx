/**
 * TBP-945 (port of bridge-svelte TBP-813) — a completed checkout or a Free pick
 * lands on `billing.successRoute` (the subscription page by default) with a
 * one-time, dismissible banner, instead of stopping on /subscription/success;
 * and the plan cards say "Choose / Upgrade to / Switch to", with the current
 * plan flagged and a formatted price block.
 *
 * Revert-proof: on origin/main `billingRoutes().successRoute` is
 * `/subscription/success`, `pickPlan` has no `complete` step, there is no
 * checkout-result signal or `<BridgeCheckoutNotice>`, and the cards say
 * "Select free plan" / "20 USD / month".
 *
 * Real components, real router (MemoryRouter), real auth-core `BridgeAuth`
 * with its network methods stubbed.
 */
import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { BridgeAuth, type Plan, type PriceOfferSdk } from '@nebulr-group/bridge-auth-core';
import { BridgeBillingRoutes } from '../src/react-router';
import { PlanSelector } from '../src/components/subscription/PlanSelector';
import { BridgeCheckoutNotice } from '../src/components/subscription/BridgeCheckoutNotice';
import { CallbackHandler } from '../src/components/auth/CallbackHandler';
import { pickPlan, type PlanPickDeps, type PlanPickOptions } from '../src/components/subscription/plan-pick';
import { resolveBillingRoutes } from '../src/core/billing-routes';
import {
  __reloadCheckoutResultForTests,
  clearCheckoutResult,
  getCheckoutResult,
  markCheckoutComplete,
  takeCheckoutResult,
  useCheckoutResult,
} from '../src/core/checkout-result';
import { _resetBridgeInstance, initBridge, setBridgeConfig, useBridgeStore } from '../src/core/bridge-instance';
import { __resetBridgeRuntime } from '../src/core/bridge-runtime';
import { resetRouterAdapter, setRouterAdapter } from '../src/utils/router-adapter';
import * as pkg from '../src/index';

const PLANS = [
  { key: 'free', name: 'Free', trial: false, prices: [{ id: 'f', amount: 0, currency: 'usd', recurrenceInterval: 'month' }] },
  { key: 'pro', name: 'Pro', trial: false, prices: [{ id: 'p', amount: 29, currency: 'usd', recurrenceInterval: 'month' }] },
  { key: 'team', name: 'Team', trial: false, prices: [{ id: 't', amount: 99, currency: 'usd', recurrenceInterval: 'month' }] },
] as unknown as Plan[];

let status: Record<string, unknown>;
let originalFetch: typeof fetch;
let originalLocation: Location;
const spies: Array<{ mockRestore(): void }> = [];

function goTo(path: string): void {
  const u = new URL(path, 'http://localhost');
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { href: u.href, origin: u.origin, pathname: u.pathname, search: u.search, hash: u.hash, assign() {}, replace() {} },
  });
}

function seed(next: Record<string, unknown>) {
  status = next;
  useBridgeStore.setState({ subscription: { status: next as never, plans: PLANS, loading: false, error: null } });
}

beforeEach(() => {
  originalLocation = window.location;
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('{}', { status: 404 })) as unknown as typeof fetch;
  try {
    window.sessionStorage.clear();
  } catch {
    /* no storage */
  }
  clearCheckoutResult();
  spies.push(spyOn(console, 'warn').mockImplementation(() => {}));
  _resetBridgeInstance();
  initBridge({ appId: 'tbp-945', apiBaseUrl: 'http://api.test.local' } as never);
  setBridgeConfig({ appId: 'tbp-945', apiBaseUrl: 'http://api.test.local' } as never);
  status = { shouldSelectPlan: true };
  const proto = BridgeAuth.prototype as unknown as Record<string, unknown>;
  spies.push(
    spyOn(proto as never, 'getSubscriptionStatus' as never).mockImplementation((async () => status) as never),
    spyOn(proto as never, 'getPlans' as never).mockImplementation((async () => PLANS) as never),
  );
});

afterEach(() => {
  cleanup();
  for (const s of spies.splice(0)) s.mockRestore();
  globalThis.fetch = originalFetch;
  clearCheckoutResult();
  resetRouterAdapter();
  __resetBridgeRuntime();
  _resetBridgeInstance();
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
});

const cards = (c: HTMLElement) => waitFor(() => expect(c.querySelector('[data-bridge-plan-card]')).not.toBeNull());

function card(c: HTMLElement, name: string): HTMLElement {
  const found = Array.from(c.querySelectorAll<HTMLElement>('[data-bridge-plan-card]')).find(
    (el) => el.querySelector('.bridge-plan-name')?.textContent === name,
  );
  if (!found) throw new Error(`no card for ${name}`);
  return found;
}
const button = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('.bridge-plan-select-btn')!;

// ── Where a checkout lands ────────────────────────────────────────────────────

describe('billing.successRoute — TBP-945', () => {
  it('defaults to the subscription page', () => {
    const r = resolveBillingRoutes(undefined);
    expect(r.successRoute).toBe('/subscription');
    expect(r.successIsDefault).toBe(true);
  });

  it('sends a checkout anywhere in the app', () => {
    const r = resolveBillingRoutes({ successRoute: '/dashboard' });
    expect(r.successRoute).toBe('/dashboard');
    expect(r.successIsDefault).toBe(false);
    expect(r.manageRoute).toBe('/subscription');
  });

  it('the old confirmation page is still reachable as an explicit successRoute', () => {
    const r = resolveBillingRoutes({ successRoute: '/subscription/success' });
    expect(r.successRoute).toBe('/subscription/success');
    expect(r.successIsDefault).toBe(false);
  });

  it('an empty successRoute counts as unset, and follows manageRoute', () => {
    const r = resolveBillingRoutes({ manageRoute: '/billing', successRoute: '' });
    expect(r.successRoute).toBe('/billing');
    expect(r.successIsDefault).toBe(true);
  });
});

// ── pickPlan records the pick ────────────────────────────────────────────────

describe('pickPlan records the pick for the landing page — TBP-945', () => {
  const FREE = PLANS[0];
  const PRO = PLANS[1];
  const FREE_PRICE = FREE.prices[0] as PriceOfferSdk;
  const PAID_PRICE = PRO.prices[0] as PriceOfferSdk;

  function setup(session: { sessionId: string | null; checkoutUrl?: string } = { sessionId: 'cs_1', checkoutUrl: 'https://stripe.test/cs_1' }) {
    const order: string[] = [];
    const deps = {
      auth: {
        selectFreePlan: mock(async () => {
          order.push('select');
        }),
        startCheckout: mock(async () => session),
      },
      refresh: mock(async () => {
        order.push('refresh');
      }),
      navigate: mock((url: string) => {
        order.push(`navigate:${url}`);
      }),
      leave: mock(() => {}),
      complete: mock((plan: Plan) => {
        order.push(`complete:${plan.key}`);
      }),
    } satisfies PlanPickDeps;
    const opts: PlanPickOptions = {
      paymentsEnabled: false,
      successRedirect: '/subscription',
      cancelRedirect: '/subscription',
      callbackBase: 'http://localhost/auth/oauth-callback',
    };
    return { deps, opts, order };
  }

  it('a Free pick: select, re-read, record, then navigate to the subscription page', async () => {
    const { deps, opts, order } = setup();
    expect(await pickPlan(FREE, FREE_PRICE, opts, deps)).toBe('selected');
    expect(order).toEqual(['select', 'refresh', 'complete:free', 'navigate:/subscription']);
    expect(deps.complete).toHaveBeenCalledWith(FREE);
  });

  it('a plan Bridge sets directly (no Stripe) is recorded the same way', async () => {
    const { deps, opts, order } = setup({ sessionId: null });
    expect(await pickPlan(PRO, PAID_PRICE, opts, deps)).toBe('selected');
    expect(order).toEqual(['refresh', 'complete:pro', 'navigate:/subscription']);
  });

  it('a Stripe checkout is not recorded by the pick: the checkout return marks it', async () => {
    const { deps, opts } = setup();
    expect(await pickPlan(PRO, PAID_PRICE, opts, deps)).toBe('checkout');
    const urls = (deps.auth.startCheckout.mock.calls[0] as unknown[])[2] as { successUrl: string };
    expect(urls.successUrl).toContain(`redirect=${encodeURIComponent('/subscription')}`);
    expect(deps.complete).not.toHaveBeenCalled();
  });

  it('complete does not run when the page passes onSelect, on either selected path', async () => {
    const onSelect = mock(() => {});
    const free = setup();
    await pickPlan(FREE, FREE_PRICE, { ...free.opts, onSelect }, free.deps);
    expect(free.deps.complete).not.toHaveBeenCalled();
    const noStripe = setup({ sessionId: null });
    expect(await pickPlan(PRO, PAID_PRICE, { ...noStripe.opts, onSelect }, noStripe.deps)).toBe('selected');
    expect(noStripe.deps.complete).not.toHaveBeenCalled();
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('complete is optional: a caller without it still navigates', async () => {
    const { deps, opts } = setup();
    const { complete: _omit, ...withoutComplete } = deps;
    expect(await pickPlan(FREE, FREE_PRICE, opts, withoutComplete)).toBe('selected');
    expect(deps.navigate).toHaveBeenCalledWith('/subscription');
  });
});

// ── The one-shot signal ──────────────────────────────────────────────────────

describe('the checkout result — TBP-945', () => {
  it('is null until marked; take returns it once and clears it', () => {
    expect(getCheckoutResult()).toBeNull();
    markCheckoutComplete({ kind: 'plan', planName: 'Pro' });
    expect(getCheckoutResult()).toEqual({ kind: 'plan', planName: 'Pro' });
    expect(takeCheckoutResult()).toEqual({ kind: 'plan', planName: 'Pro' });
    expect(takeCheckoutResult()).toBeNull();
  });

  it('useCheckoutResult re-renders when it is marked and cleared, without clearing it', () => {
    const seen: Array<string | null> = [];
    function Probe() {
      const r = useCheckoutResult();
      seen.push(r ? r.kind : null);
      return null;
    }
    render(<Probe />);
    act(() => markCheckoutComplete({ kind: 'checkout' }));
    expect(getCheckoutResult()).toEqual({ kind: 'checkout' });
    act(() => clearCheckoutResult());
    expect(seen).toEqual([null, 'checkout', null]);
  });

  it('survives exactly one full page load (no router adapter), then never again', () => {
    markCheckoutComplete({ kind: 'checkout' });
    // The SDK navigated with window.location: a fresh page load re-reads the hand-over.
    __reloadCheckoutResultForTests();
    expect(getCheckoutResult()).toEqual({ kind: 'checkout' });
    expect(window.sessionStorage.getItem('bridge:checkout-result')).toBeNull();
    // A second reload, whether or not anything showed it, has nothing.
    __reloadCheckoutResultForTests();
    expect(getCheckoutResult()).toBeNull();
  });

  it('once shown, a reload does not bring it back', () => {
    markCheckoutComplete({ kind: 'plan', planName: 'Pro' });
    takeCheckoutResult();
    __reloadCheckoutResultForTests();
    expect(getCheckoutResult()).toBeNull();
  });

  it('ignores a stale or malformed hand-over', () => {
    window.sessionStorage.setItem(
      'bridge:checkout-result',
      JSON.stringify({ at: Date.now() - 10 * 60 * 1000, result: { kind: 'checkout' } }),
    );
    __reloadCheckoutResultForTests();
    expect(getCheckoutResult()).toBeNull();
    window.sessionStorage.setItem('bridge:checkout-result', JSON.stringify({ at: Date.now(), result: { kind: 'nope' } }));
    __reloadCheckoutResultForTests();
    expect(getCheckoutResult()).toBeNull();
    window.sessionStorage.setItem('bridge:checkout-result', '{not json');
    __reloadCheckoutResultForTests();
    expect(getCheckoutResult()).toBeNull();
  });

  it('is exported for apps, but only the SDK marks it', () => {
    expect(typeof pkg.BridgeCheckoutNotice).toBe('function');
    expect(typeof pkg.useCheckoutResult).toBe('function');
    expect(typeof pkg.takeCheckoutResult).toBe('function');
    expect(typeof pkg.clearCheckoutResult).toBe('function');
    expect(typeof pkg.getCheckoutResult).toBe('function');
    expect((pkg as Record<string, unknown>).markCheckoutComplete).toBeUndefined();
  });
});

// ── <BridgeCheckoutNotice> ───────────────────────────────────────────────────

describe('<BridgeCheckoutNotice> — TBP-945', () => {
  const notice = (c: HTMLElement) => c.querySelector('[data-bridge-checkout-notice]');

  it('renders nothing when no checkout has just completed', () => {
    const { container } = render(<BridgeCheckoutNotice />);
    expect(container.innerHTML).toBe('');
  });

  it('names the plan, shows once, and is dismissible', async () => {
    markCheckoutComplete({ kind: 'plan', planName: 'Pro' });
    const { container, unmount } = render(<BridgeCheckoutNotice />);
    expect(notice(container)?.getAttribute('data-kind')).toBe('plan');
    expect(notice(container)?.getAttribute('role')).toBe('status');
    expect(container.querySelector('.bridge-checkout-notice-title')?.textContent).toBe("You're on Pro now");
    expect(container.textContent).toContain('The change takes effect right away.');
    // Taken: the signal is cleared once it is on screen.
    await waitFor(() => expect(getCheckoutResult()).toBeNull());
    fireEvent.click(container.querySelector('[aria-label="Dismiss"]')!);
    expect(notice(container)).toBeNull();
    unmount();
    // A later visit (a new mount) shows nothing.
    expect(render(<BridgeCheckoutNotice />).container.innerHTML).toBe('');
  });

  it('a paid checkout says the payment went through; without a plan name it says so generically', () => {
    markCheckoutComplete({ kind: 'checkout' });
    const { container } = render(<BridgeCheckoutNotice dismissible={false} />);
    expect(container.querySelector('.bridge-checkout-notice-title')?.textContent).toBe('Your new plan is active');
    expect(container.textContent).toContain('Your payment went through and the new plan is active.');
    expect(container.querySelector('[aria-label="Dismiss"]')).toBeNull();
  });

  it('falls back to the current plan in the subscription store for the name', () => {
    seed({ plan: { key: 'team', name: 'Team' } });
    markCheckoutComplete({ kind: 'checkout' });
    const { container } = render(<BridgeCheckoutNotice />);
    expect(container.querySelector('.bridge-checkout-notice-title')?.textContent).toBe("You're on Team now");
  });

  it('shows a result marked while it is already on screen', () => {
    const { container } = render(<BridgeCheckoutNotice />);
    expect(notice(container)).toBeNull();
    act(() => markCheckoutComplete({ kind: 'plan', planName: 'Free' }));
    expect(container.querySelector('.bridge-checkout-notice-title')?.textContent).toBe("You're on Free now");
  });

  it('children replaces the text and receives the result with a nullable plan name', () => {
    markCheckoutComplete({ kind: 'checkout' });
    const { container } = render(
      <BridgeCheckoutNotice className="mine">
        {({ kind, planName }) => <em data-custom>{`${kind}:${planName ?? 'none'}`}</em>}
      </BridgeCheckoutNotice>,
    );
    expect(container.querySelector('[data-custom]')?.textContent).toBe('checkout:none');
    expect(notice(container)?.className).toBe('bridge-checkout-notice mine');
    expect(container.querySelector('.bridge-checkout-notice-title')).toBeNull();
  });
});

// ── The restyled plan card ───────────────────────────────────────────────────

describe('<PlanSelector> default card — TBP-945', () => {
  it('with no current plan, every button is "Choose X" and no card is flagged', async () => {
    seed({ shouldSelectPlan: true });
    const { container } = render(<PlanSelector />);
    await cards(container);
    expect(button(card(container, 'Free')).textContent).toBe('Choose Free');
    expect(button(card(container, 'Pro')).textContent).toBe('Choose Pro');
    expect(button(card(container, 'Team')).textContent).toBe('Choose Team');
    expect(card(container, 'Pro').getAttribute('data-pick')).toBe('choose');
    expect(container.querySelector('[data-bridge-plan-current-flag]')).toBeNull();
    expect(container.textContent).not.toContain('Select free plan');
    expect(container.textContent).not.toContain('29 USD / month');
  });

  it('relative to the current plan: Current plan / Upgrade to / Switch to', async () => {
    seed({ plan: 'pro', paymentsEnabled: false });
    const { container } = render(<PlanSelector />);
    await cards(container);

    const pro = card(container, 'Pro');
    expect(button(pro).textContent).toBe('Current plan');
    expect(button(pro).disabled).toBe(true);
    expect(pro.getAttribute('data-current')).toBe('true');
    expect(pro.getAttribute('data-pick')).toBe('current');
    expect(pro.querySelector('[data-bridge-plan-current-flag]')?.textContent).toBe('Your plan');

    const team = card(container, 'Team');
    expect(button(team).textContent).toBe('Upgrade to Team');
    expect(team.getAttribute('data-pick')).toBe('upgrade');
    expect(button(team).className).toContain('bridge-btn-primary');
    expect(team.querySelector('[data-bridge-plan-current-flag]')).toBeNull();

    const free = card(container, 'Free');
    expect(button(free).textContent).toBe('Switch to Free');
    expect(free.getAttribute('data-pick')).toBe('switch');
    expect(button(free).className).toContain('bridge-btn-secondary');
  });

  it('reads a current plan given as an object, as the REST status returns it', async () => {
    seed({ plan: { key: 'team', name: 'Team' } });
    const { container } = render(<PlanSelector />);
    await cards(container);
    expect(button(card(container, 'Team')).textContent).toBe('Current plan');
    expect(button(card(container, 'Pro')).textContent).toBe('Switch to Pro');
  });

  it('each card shows its price as a formatted amount and interval, and features get a check mark', async () => {
    seed({ shouldSelectPlan: true });
    const { container } = render(<PlanSelector />);
    await cards(container);
    const price = card(container, 'Pro').querySelector('[data-bridge-plan-price]')!;
    expect(price.querySelector('.bridge-plan-price-amount')?.textContent).toBe('$29');
    expect(price.querySelector('.bridge-plan-price-interval')?.textContent).toBe('/ month');
    expect(card(container, 'Free').querySelector('.bridge-plan-price-amount')?.textContent).toBe('$0');
  });

  it('a heading renders above the plans only when given', async () => {
    seed({ shouldSelectPlan: true });
    const first = render(<PlanSelector />);
    await cards(first.container);
    expect(first.container.querySelector('[data-bridge-plan-head]')).toBeNull();
    cleanup();
    const { container } = render(<PlanSelector heading="Change plan" />);
    await cards(container);
    expect(container.querySelector('[data-bridge-plan-head] h2.bridge-plan-heading')?.textContent).toBe('Change plan');
  });

  it('the plan-change dialog has no em dash in its note', async () => {
    seed({ plan: 'free', paymentsEnabled: true });
    const { container } = render(<PlanSelector />);
    await cards(container);
    fireEvent.click(button(card(container, 'Pro')));
    await waitFor(() => expect(container.querySelector('[data-bridge-plan-confirm]')).not.toBeNull());
    const note = container.querySelector('.bridge-plan-confirm-note')!.textContent!;
    expect(note).toBe('The change takes effect immediately. Any price difference is prorated on your next invoice.');
    expect(container.querySelector('.bridge-plan-confirm-body')?.textContent).toContain('$29 / month');
  });
});

// ── <BridgeBillingRoutes>: a Free pick lands on the subscription page ─────────

function billingApp(path: string, element = <BridgeBillingRoutes />) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/subscription/*" element={element} />
        <Route path="/billing/*" element={element} />
        <Route path="/dashboard" element={<div data-dashboard><BridgeCheckoutNotice /></div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('<BridgeBillingRoutes> landing — TBP-945', () => {
  const freePick = () =>
    spies.push(
      spyOn(BridgeAuth.prototype as never, 'selectFreePlan' as never).mockImplementation((async () => {
        status = { shouldSelectPlan: false, plan: { key: 'free', name: 'Free' } };
      }) as never),
    );

  it('the manage page: subtitle, current-plan summary, and a "Change plan" heading', async () => {
    seed({ shouldSelectPlan: false, plan: { key: 'free', name: 'Free' } });
    const { container } = billingApp('/subscription');
    await cards(container);
    expect(container.querySelector('.bridge-billing-text')?.textContent).toBe('Your plan, what it includes, and billing.');
    const summary = container.querySelector('[data-bridge-billing-summary]')!;
    expect(summary.querySelector('.bridge-billing-label')?.textContent).toBe('Current plan');
    expect(summary.querySelector('.bridge-subscription-status.bridge-billing-summary-status')).not.toBeNull();
    expect(container.querySelector('[data-bridge-plan-head] .bridge-plan-heading')?.textContent).toBe('Change plan');
    expect(container.querySelector('[data-bridge-checkout-notice]')).toBeNull();
  });

  it('a Free pick on the paywall lands on the subscription page with the banner, shown once', async () => {
    seed({ shouldSelectPlan: true });
    freePick();
    const first = billingApp('/subscription/plan');
    await cards(first.container);
    fireEvent.click(button(card(first.container, 'Free')));
    await waitFor(() =>
      expect(first.container.querySelector('[data-bridge-billing-route]')?.getAttribute('data-bridge-billing-route')).toBe(
        'manage',
      ),
    );
    await waitFor(() =>
      expect(first.container.querySelector('.bridge-checkout-notice-title')?.textContent).toBe("You're on Free now"),
    );
    await waitFor(() => expect(getCheckoutResult()).toBeNull());
    // Coming back to the page later: no banner.
    cleanup();
    const again = billingApp('/subscription');
    await cards(again.container);
    expect(again.container.querySelector('[data-bridge-checkout-notice]')).toBeNull();
  });

  it('lands on its own subscription page wherever it is mounted', async () => {
    seed({ shouldSelectPlan: true });
    freePick();
    const { container } = billingApp('/billing/plan');
    await cards(container);
    fireEvent.click(button(card(container, 'Free')));
    await waitFor(() =>
      expect(container.querySelector('[data-bridge-billing-route]')?.getAttribute('data-bridge-billing-route')).toBe('manage'),
    );
    await waitFor(() => expect(container.querySelector('[data-bridge-checkout-notice]')).not.toBeNull());
  });

  it('billing.successRoute lands elsewhere, where <BridgeCheckoutNotice> shows the same banner', async () => {
    setBridgeConfig({ appId: 'tbp-945', apiBaseUrl: 'http://api.test.local', billing: { successRoute: '/dashboard' } } as never);
    seed({ shouldSelectPlan: true });
    freePick();
    const { container } = billingApp('/subscription/plan');
    await cards(container);
    fireEvent.click(button(card(container, 'Free')));
    await waitFor(() => expect(container.querySelector('[data-dashboard]')).not.toBeNull());
    expect(container.querySelector('[data-dashboard] .bridge-checkout-notice-title')?.textContent).toBe("You're on Free now");
  });

  it('checkoutNotice={false} hides the banner on the subscription page', async () => {
    seed({ shouldSelectPlan: false, plan: { key: 'pro', name: 'Pro' } });
    markCheckoutComplete({ kind: 'checkout' });
    const { container } = billingApp('/subscription', <BridgeBillingRoutes checkoutNotice={false} />);
    await cards(container);
    expect(container.querySelector('[data-bridge-checkout-notice]')).toBeNull();
  });

  it('the old success page still works, and clears the banner so it is not shown twice', async () => {
    seed({ shouldSelectPlan: false, plan: { key: 'pro', name: 'Pro' } });
    markCheckoutComplete({ kind: 'checkout' });
    const { container } = billingApp('/subscription/success');
    expect(container.querySelector('[data-bridge-billing-route]')?.getAttribute('data-bridge-billing-route')).toBe('success');
    expect(container.textContent).toContain("You're all set");
    await waitFor(() => expect(getCheckoutResult()).toBeNull());
  });

  it('a page already open when a Free pick lands back on it shows the banner too', async () => {
    seed({ shouldSelectPlan: false, plan: { key: 'pro', name: 'Pro' } });
    freePick();
    const { container } = billingApp('/subscription');
    await cards(container);
    fireEvent.click(button(card(container, 'Free')));
    await waitFor(() =>
      expect(container.querySelector('.bridge-checkout-notice-title')?.textContent).toBe("You're on Free now"),
    );
  });
});

// ── <CallbackHandler>: a confirmed Stripe checkout marks the result ──────────

describe('<CallbackHandler> on a Stripe return — TBP-945', () => {
  function stripeReturn(confirm: () => Promise<void>) {
    const replaced: Array<{ path: string; result: unknown }> = [];
    setRouterAdapter({
      navigate: () => {},
      replace: (p) => replaced.push({ path: p, result: getCheckoutResult() }),
      getCurrentPath: () => '/auth/oauth-callback',
    });
    const proto = BridgeAuth.prototype as unknown as Record<string, unknown>;
    spies.push(
      spyOn(proto as never, 'confirmStripeCheckout' as never).mockImplementation(confirm as never),
      spyOn(proto as never, 'shouldRedirectToPaywall' as never).mockImplementation((async () => false) as never),
    );
    goTo(`/auth/oauth-callback?stripe_success=1&session_id=cs_945&redirect=${encodeURIComponent('/subscription')}`);
    render(<CallbackHandler />);
    return replaced;
  }

  it('marks the checkout before landing on the subscription page', async () => {
    const replaced = stripeReturn(async () => {});
    await waitFor(() => expect(replaced.length).toBe(1));
    expect(replaced[0]).toEqual({ path: '/subscription', result: { kind: 'checkout' } });
  });

  it('a failed confirmation marks nothing and goes to the payment-error page', async () => {
    const replaced = stripeReturn(async () => {
      throw new Error('declined');
    });
    await waitFor(() => expect(replaced.length).toBe(1));
    expect(replaced[0]).toEqual({ path: '/subscription/error', result: null });
  });
});

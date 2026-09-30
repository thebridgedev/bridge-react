/**
 * TBP-743 — subscription pages and the paywall "the same way" as the sign-in
 * pages: one `<BridgeBillingRoutes>` route, router adapters, override by
 * element; the default billing destinations point at pages it serves; and the
 * TBP-515 S2 plan-card render props on `<PlanSelector>`.
 *
 * Revert-proof: `BridgeBillingRoutes`, `billing-routes` and the
 * `planDescription` / `planFooter` / interval / features behaviour do not exist
 * on origin/main, and there the provider only redirects plan-less workspaces
 * when `billing.paywallRoute` is set (the default-paywall tests fail).
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { BridgeAuth, type Plan } from '@nebulr-group/bridge-auth-core';
import { BridgeBillingRoutes } from '../src/react-router';
import { PlanSelector } from '../src/components/subscription/PlanSelector';
import {
  appUsesBilling,
  isPaywallExempt,
  parseBridgeBillingRoute,
  resolveBillingRoutes,
} from '../src/core/billing-routes';
import { BridgeProvider } from '../src/providers/bridge-provider';
import { _resetBridgeInstance, initBridge, setBridgeConfig, useBridgeStore } from '../src/core/bridge-instance';
import { __resetBridgeRuntime } from '../src/core/bridge-runtime';
import { resetRouterAdapter, setRouterAdapter } from '../src/utils/router-adapter';

const PLANS = [
  {
    key: 'pro',
    name: 'Pro',
    description: 'For teams',
    trial: false,
    prices: [
      { id: 'p-m', amount: 20, currency: 'usd', recurrenceInterval: 'month' },
      { id: 'p-y', amount: 200, currency: 'usd', recurrenceInterval: 'year' },
    ],
    features: [{ key: 'analytics', name: 'Analytics' }],
  },
  {
    key: 'free',
    name: 'Free',
    trial: false,
    prices: [{ id: 'f', amount: 0, currency: 'usd', recurrenceInterval: 'month' }],
  },
] as unknown as Plan[];

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

function seedSubscription(status: Record<string, unknown> = { shouldSelectPlan: true }) {
  useBridgeStore.setState({
    subscription: { status: status as never, plans: PLANS, loading: false, error: null },
  });
}

beforeEach(() => {
  originalLocation = window.location;
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('{}', { status: 404 })) as unknown as typeof fetch;
  spies.push(spyOn(console, 'warn').mockImplementation(() => {}));
  _resetBridgeInstance();
  initBridge({ appId: 'tbp-743', apiBaseUrl: 'http://api.test.local' } as never);
  setBridgeConfig({ appId: 'tbp-743', apiBaseUrl: 'http://api.test.local' } as never);
  const proto = BridgeAuth.prototype as unknown as Record<string, unknown>;
  spies.push(
    spyOn(proto as never, 'getSubscriptionStatus' as never).mockImplementation((async () => ({ shouldSelectPlan: true })) as never),
    spyOn(proto as never, 'getPlans' as never).mockImplementation((async () => PLANS) as never),
  );
});

afterEach(() => {
  cleanup();
  for (const s of spies.splice(0)) s.mockRestore();
  globalThis.fetch = originalFetch;
  resetRouterAdapter();
  __resetBridgeRuntime();
  _resetBridgeInstance();
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
});

describe('billing routes', () => {
  it('serves the subscription page, the paywall and the two checkout return pages', () => {
    expect(parseBridgeBillingRoute('')).toEqual({ page: 'manage' });
    expect(parseBridgeBillingRoute('plan')).toEqual({ page: 'plan' });
    expect(parseBridgeBillingRoute('success')).toEqual({ page: 'success' });
    expect(parseBridgeBillingRoute('error')).toEqual({ page: 'error' });
    expect(parseBridgeBillingRoute('plan/x')).toBeNull();
    expect(parseBridgeBillingRoute('billing')).toBeNull();
  });

  it('points every destination at a page it serves when nothing is configured', () => {
    expect(resolveBillingRoutes(undefined)).toEqual({
      manageRoute: '/subscription',
      paywallRoute: '/subscription/plan',
      paywallIsDefault: true,
      paymentErrorRoute: '/subscription/error',
      successRoute: '/subscription/success',
    });
  });

  it('a configured route wins; paywallRoute: false turns the paywall off', () => {
    const r = resolveBillingRoutes({ manageRoute: '/plans', paywallRoute: '/welcome' });
    expect(r.successRoute).toBe('/plans/success');
    expect(r.paywallRoute).toBe('/welcome');
    expect(r.paywallIsDefault).toBe(false);
    expect(resolveBillingRoutes({ paywallRoute: false }).paywallRoute).toBeNull();
  });

  it('never redirects the paywall to itself, and leaves the payment-error page readable', () => {
    const r = resolveBillingRoutes(undefined);
    expect(isPaywallExempt('/subscription/plan', r)).toBe(true);
    expect(isPaywallExempt('/subscription/error', r)).toBe(true);
    expect(isPaywallExempt('/subscription', r)).toBe(false);
    expect(appUsesBilling([])).toBe(false);
    expect(appUsesBilling(PLANS)).toBe(true);
  });
});

function billingApp(path: string, element = <BridgeBillingRoutes />) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/subscription/*" element={element} />
      </Routes>
    </MemoryRouter>,
  );
}
// <PlanSelector> re-reads on mount (the seeded store is older than 30 s as far
// as it knows); wait for the cards the mocked read brings back.
const cards = (c: HTMLElement) => waitFor(() => expect(c.querySelector('[data-bridge-plan-card]')).not.toBeNull());

const pageOf = (c: HTMLElement) =>
  c.querySelector('[data-bridge-billing-route]')?.getAttribute('data-bridge-billing-route');

describe('<BridgeBillingRoutes> on <Route path="/subscription/*">', () => {
  it('/subscription is the manage page: current plan and the plan picker', () => {
    seedSubscription({ shouldSelectPlan: false, plan: { key: 'free' } });
    const { container } = billingApp('/subscription');
    expect(pageOf(container)).toBe('manage');
    expect(container.querySelector('.bridge-subscription-status')).not.toBeNull();
    expect(container.querySelector('[data-bridge-plan-selector]')).not.toBeNull();
  });

  it('/subscription/plan is the paywall', () => {
    seedSubscription();
    const { container } = billingApp('/subscription/plan');
    expect(pageOf(container)).toBe('plan');
    expect(container.textContent).toContain('Choose a plan');
  });

  it('/subscription/error explains and links back to the subscription page', () => {
    const { container } = billingApp('/subscription/error');
    expect(pageOf(container)).toBe('error');
    expect(container.querySelector('a[href="/subscription"]')).not.toBeNull();
  });

  it('a page is taken over by passing an element; heading and frame customise the rest', () => {
    seedSubscription();
    const el = (
      <BridgeBillingRoutes
        pages={{ plan: <h1 data-testid="mine">Pricing</h1> }}
        heading={(page) => <h2 data-heading>{page}</h2>}
        frame={(page, children) => <section data-frame={page}>{children}</section>}
      />
    );
    const plan = billingApp('/subscription/plan', el);
    expect(plan.getByTestId('mine').textContent).toBe('Pricing');
    expect(plan.container.querySelector('[data-bridge-plan-selector]')).toBeNull();
    cleanup();
    const success = billingApp('/subscription/success', el);
    expect(success.container.querySelector('section[data-frame="success"] [data-heading]')?.textContent).toBe('success');
  });

  it('an unknown page under the mount point is not found', () => {
    const { container } = billingApp('/subscription/nope');
    expect(pageOf(container)).toBe('not-found');
  });
});

describe('<PlanSelector> — S2 plan-card render props and svelte parity', () => {
  it('planDescription replaces the description and planFooter renders under the prices', async () => {
    seedSubscription();
    const { container } = render(
      <PlanSelector
        planDescription={({ plan }) => <p data-desc={plan.key}>Custom {plan.name}</p>}
        planFooter={({ plan, isCurrent }) => <small data-footer={plan.key}>{isCurrent ? 'yours' : 'fine print'}</small>}
      />,
    );
    await cards(container);
    expect(container.querySelector('[data-desc="pro"]')?.textContent).toBe('Custom Pro');
    expect(container.querySelector('.bridge-plan-description')).toBeNull();
    const proCard = container.querySelector('[data-desc="pro"]')?.closest('[data-bridge-plan-card]');
    expect(proCard?.lastElementChild?.getAttribute('data-footer')).toBe('pro');
  });

  it('cheapest plan first, the features the plan includes, and interval tabs that switch the price', async () => {
    seedSubscription();
    const { container } = render(<PlanSelector />);
    await cards(container);
    const names = Array.from(container.querySelectorAll('.bridge-plan-name')).map((n) => n.textContent);
    expect(names).toEqual(['Free', 'Pro']);
    expect(container.querySelector('[data-feature="analytics"]')?.textContent).toBe('Analytics');
    const priceText = () => Array.from(container.querySelectorAll('.bridge-plan-select-btn')).map((b) => b.textContent);
    // Yearly is the default tab.
    expect(priceText()).toContain('200 USD / year');
    const monthly = Array.from(container.querySelectorAll('.bridge-plan-interval-tab')).find((b) => b.textContent === 'Monthly')!;
    fireEvent.click(monthly);
    expect(priceText()).toContain('20 USD / month');
    // The free plan stays selectable under every tab.
    expect(priceText()).toContain('Select free plan');
  });

  it('planCard receives the active interval', async () => {
    seedSubscription();
    const seen: string[] = [];
    render(
      <PlanSelector
        planCard={({ plan, interval }) => {
          seen.push(`${plan.key}:${interval}`);
          return <div />;
        }}
      />,
    );
    await waitFor(() => expect(seen).toContain('pro:year'));
  });

  it('a free pick goes on to successRedirect through the router adapter', async () => {
    seedSubscription();
    const navigations: string[] = [];
    setRouterAdapter({ navigate: (p) => navigations.push(p), replace: () => {}, getCurrentPath: () => '/' });
    spies.push(
      spyOn(BridgeAuth.prototype as never, 'selectFreePlan' as never).mockImplementation((async () => undefined) as never),
    );
    const { container } = render(<PlanSelector successRedirect="/subscription/success" />);
    await cards(container);
    const free = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Select free plan')!;
    fireEvent.click(free);
    await waitFor(() => expect(navigations).toEqual(['/subscription/success']));
  });
});

describe('the default paywall', () => {
  function mountProvider(config: Record<string, unknown>, plans: Plan[]) {
    const replaced: string[] = [];
    setRouterAdapter({ navigate: () => {}, replace: (p) => replaced.push(p), getCurrentPath: () => '/dashboard' });
    _resetBridgeInstance();
    const proto = BridgeAuth.prototype as unknown as Record<string, unknown>;
    spies.push(
      spyOn(proto as never, 'shouldRedirectToPaywall' as never).mockImplementation((async () => true) as never),
      spyOn(proto as never, 'getPlans' as never).mockImplementation((async () => plans) as never),
      spyOn(proto as never, 'refreshTokens' as never).mockImplementation((async () => null) as never),
    );
    goTo('/dashboard');
    render(
      <BridgeProvider appId="tbp-743" config={{ apiBaseUrl: 'http://api.test.local', ...config }}>
        <div />
      </BridgeProvider>,
    );
    return replaced;
  }
  const settle = () => new Promise((r) => setTimeout(r, 30));

  it('a plan-less workspace of an app with plans goes to /subscription/plan with nothing configured', async () => {
    const replaced = mountProvider({}, PLANS);
    await waitFor(() => expect(replaced).toEqual(['/subscription/plan']));
  });

  it('an app with no plans is not sent to a paywall it does not have', async () => {
    const replaced = mountProvider({}, []);
    await settle();
    expect(replaced).toEqual([]);
  });

  it('paywallRoute: false turns it off', async () => {
    const replaced = mountProvider({ billing: { paywallRoute: false } }, PLANS);
    await settle();
    expect(replaced).toEqual([]);
  });
});

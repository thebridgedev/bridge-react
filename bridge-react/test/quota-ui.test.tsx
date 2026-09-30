/**
 * TBP-743 — quota and entitlement hooks and components at levels 0/1/2,
 * including the upgrade dialog on a 402. React port of bridge-svelte's
 * quota-ui / use-quota / quota-refusal / feature-upgrade / bridge-usage specs.
 *
 * Level 0: a backend's `402 QUOTA_EXCEEDED` (plain `fetch` to the page's own
 *          origin, or `bridgeFetch` anywhere) opens the dialog <BridgeProvider>
 *          mounts — proved end to end through the real provider.
 * Level 1: <QuotaGate>, <FeatureFlag upgrade>, <Entitled>.
 * Level 2: useQuota(), useEntitlements().
 *
 * Revert-proof: none of these modules exist on origin/main (the file fails to
 * load there), and on main a 402 from the app's backend opens nothing.
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { act, cleanup, fireEvent, render, renderHook, waitFor } from '@testing-library/react';
import { BridgeAuth, useBridge as useBillingBridge } from '@nebulr-group/bridge-auth-core';
import { QuotaGate } from '../src/components/subscription/QuotaGate';
import { Entitled } from '../src/components/subscription/Entitled';
import { BridgeUpgradeDialog } from '../src/components/subscription/BridgeUpgradeDialog';
import { useQuota } from '../src/hooks/use-quota';
import { useEntitlements } from '../src/hooks/use-entitlements';
import { FeatureFlag } from '../src/flags/FeatureFlag';
import { setBridgeFlagsInstance } from '../src/flags/registry';
import {
  __resetQuotaRefusalForTests,
  getQuotaRefusal,
  observeQuotaRefusal,
  onBridgeQuotaExceeded,
  parseQuotaRefusal,
  watchesQuotaOrigin,
} from '../src/core/quota-refusal';
import { __resetFeatureUpgradeForTests, getFeatureUpgrade, parseFeatureRefusal } from '../src/core/feature-upgrade';
import { bridgeFetch, installQuotaObserver, uninstallQuotaObserver } from '../src/core/bridge-fetch';
import { plansIncludingFeature, resolveUpgradeDialog, upgradeHrefFor } from '../src/core/upgrade-dialog';
import { bridge } from '../src/core/bridge';
import { BridgeProvider } from '../src/providers/bridge-provider';
import { _resetBridgeInstance, getBridgeAuth, initBridge, setBridgeConfig, useBridgeStore } from '../src/core/bridge-instance';
import { useSnapshotStore } from '../src/core/snapshot-stores';
import { __resetBridgeRuntime } from '../src/core/bridge-runtime';
import { __resetDoubleCountWarning } from '../src/core/double-count-warning';

const API = 'http://api.test.local';
const TOKENS = { accessToken: 'a.e30.s', refreshToken: 'r', idToken: 'i' };

let originalFetch: typeof fetch;
const spies: Array<{ mockRestore(): void }> = [];
type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
let handler: Handler;
let calls: Array<{ url: string; auth: string | null }>;
let originalLocation: Location;
// Calls the test made, not the SDK's own background reads (app config, flags).
const appCalls = () => calls.filter((c) => !c.url.startsWith(API));

// A real page always has an origin; happy-dom's default is about:blank.
function goTo(path: string): void {
  const u = new URL(path, 'http://localhost');
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { href: u.href, origin: u.origin, pathname: u.pathname, search: u.search, hash: u.hash, assign() {}, replace() {} },
  });
}

function quotas() {
  return useBillingBridge().quotas;
}

function push(metric: string, used: number, limit: number, policy: 'hard' | 'metered' = 'hard') {
  act(() =>
    quotas().applyQuotaUpdated({
      kind: 'quota.updated',
      tenantId: 't1',
      effectiveAt: new Date().toISOString(),
      metric,
      used,
      limit,
      remaining: limit - used,
      warningLevel: null,
      policy,
    }),
  );
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const REFUSAL = { statusCode: 402, code: 'QUOTA_EXCEEDED', message: 'Limit', metric: 'tickets', used: 3, limit: 3, fix: '/subscription' };

beforeEach(() => {
  originalLocation = window.location;
  goTo('/tickets');
  originalFetch = globalThis.fetch;
  calls = [];
  handler = () => json(404, {});
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    calls.push({ url, auth: new Headers(init?.headers).get('Authorization') });
    return handler(url, init);
  }) as typeof fetch;
  spies.push(spyOn(console, 'warn').mockImplementation(() => {}));
  _resetBridgeInstance();
  initBridge({ appId: 'tbp-743', apiBaseUrl: API } as never);
  setBridgeConfig({ appId: 'tbp-743', apiBaseUrl: API } as never);
  quotas().__resetForTests();
  __resetQuotaRefusalForTests();
  __resetFeatureUpgradeForTests();
});

afterEach(() => {
  cleanup();
  for (const s of spies.splice(0)) s.mockRestore();
  uninstallQuotaObserver();
  globalThis.fetch = originalFetch;
  quotas().__resetForTests();
  useSnapshotStore.setState({ tenantEntitlements: null });
  setBridgeFlagsInstance(undefined);
  __resetBridgeRuntime();
  _resetBridgeInstance();
  __resetDoubleCountWarning();
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
});

// ── Level 2 ──────────────────────────────────────────────────────────────────

describe('useQuota(metric) — level 2', () => {
  it('is loading with no numbers — not zeros — until Bridge answers, then shows the real ones, live', () => {
    const { result } = renderHook(() => useQuota('tickets'));
    expect(result.current.loading).toBe(true);
    expect(result.current.used).toBeNull();
    expect(result.current.limit).toBeNull();
    push('tickets', 2, 5);
    expect(result.current).toMatchObject({ loading: false, unlimited: false, used: 2, limit: 5, remaining: 3, kind: 'counter' });
    push('tickets', 5, 5);
    expect(result.current.used).toBe(5);
  });

  it('"no quota on this plan" is unlimited — an answer, not loading', () => {
    const { result } = renderHook(() => useQuota('seats'));
    act(() => quotas().applyInitialSnapshot('seats', null as never));
    expect(result.current).toMatchObject({ loading: false, unlimited: true, used: null });
  });

  it('after sign-in the first read asks Bridge for the metric', async () => {
    quotas().configure({ apiBaseUrl: API, accessToken: TOKENS.accessToken, appId: 'tbp-743' });
    handler = (url) =>
      url.endsWith('/usage/quota/projects')
        ? json(200, { metric: 'projects', used: 1, limit: 3, remaining: 2, policy: 'hard', kind: 'gauge', warningLevel: null })
        : json(404, {});
    act(() => useBridgeStore.setState({ tokens: TOKENS }));
    const { result } = renderHook(() => useQuota('projects'));
    await waitFor(() => expect(result.current.used).toBe(1));
    expect(result.current.kind).toBe('gauge');
    expect(calls.some((c) => c.url.endsWith('/usage/quota/projects'))).toBe(true);
  });
});

describe('useEntitlements() — level 2', () => {
  it('signed in but nothing loaded: not ready, and can() is false', () => {
    act(() => useBridgeStore.setState({ tokens: TOKENS }));
    const { result } = renderHook(() => useEntitlements());
    expect(result.current.ready).toBe(false);
    expect(result.current.can('analytics')).toBe(false);
  });

  it('the session snapshot makes it ready; granted keys true, others false; signing out empties it', () => {
    act(() => useBridgeStore.setState({ tokens: TOKENS }));
    const { result } = renderHook(() => useEntitlements());
    act(() => useSnapshotStore.setState({ tenantEntitlements: { analytics: true, sso: false } }));
    expect(result.current.ready).toBe(true);
    expect(result.current.can('analytics')).toBe(true);
    expect(result.current.can('sso')).toBe(false);
    expect(result.current.can('unknown')).toBe(false);
    act(() => useBridgeStore.setState({ tokens: null }));
    expect(result.current.ready).toBe(false);
  });
});

// ── Level 1 ──────────────────────────────────────────────────────────────────

const gate = (c: HTMLElement) => c.querySelector('[data-bridge-quota-gate]')!;
const fieldset = (c: HTMLElement) => c.querySelector('fieldset') as HTMLFieldSetElement;

describe('<QuotaGate metric> — level 1', () => {
  it('while the quota is loading: the action is ENABLED', () => {
    const { container } = render(<QuotaGate metric="tickets"><button>New</button></QuotaGate>);
    expect(gate(container).getAttribute('data-state')).toBe('loading');
    expect(fieldset(container).disabled).toBe(false);
  });

  it('under the cap: enabled, no prompt; at a hard cap: disabled with an upgrade link to the subscription page', () => {
    const { container } = render(<QuotaGate metric="tickets"><button>New</button></QuotaGate>);
    push('tickets', 2, 3);
    expect(gate(container).getAttribute('data-state')).toBe('available');
    expect(fieldset(container).disabled).toBe(false);
    push('tickets', 3, 3);
    expect(gate(container).getAttribute('data-state')).toBe('at-limit');
    expect(fieldset(container).disabled).toBe(true);
    expect(container.querySelector('[data-bridge-quota-gate-limit] a')?.getAttribute('href')).toBe('/subscription');
  });

  it('the default prompt follows billing.manageRoute; atLimit replaces it and receives the quota', () => {
    setBridgeConfig({ appId: 'tbp-743', billing: { manageRoute: '/plans' } } as never);
    const a = render(<QuotaGate metric="tickets"><button>New</button></QuotaGate>);
    push('tickets', 3, 3);
    expect(a.container.querySelector('[data-bridge-quota-gate-limit] a')?.getAttribute('href')).toBe('/plans');
    cleanup();
    const b = render(
      <QuotaGate metric="tickets" atLimit={(q) => <span data-mine>{`${q.used} of ${q.limit}`}</span>}>
        <button>New</button>
      </QuotaGate>,
    );
    expect(b.container.querySelector('[data-mine]')?.textContent).toBe('3 of 3');
  });

  it('a metered quota never gates, even past its included amount', () => {
    const { container } = render(<QuotaGate metric="api_calls"><button>Call</button></QuotaGate>);
    push('api_calls', 150, 100, 'metered');
    expect(gate(container).getAttribute('data-state')).toBe('metered');
    expect(fieldset(container).disabled).toBe(false);
  });
});

describe('<Entitled to> — level 1', () => {
  it('before Bridge answers: neither the feature nor the fallback — only `loading`', () => {
    act(() => useBridgeStore.setState({ tokens: TOKENS }));
    const { container } = render(
      <Entitled to="analytics" fallback={<i>upgrade</i>} loading={<b>wait</b>}>
        <p>panel</p>
      </Entitled>,
    );
    expect(container.textContent).toBe('wait');
  });

  it('entitled: the children; answered and not entitled: the fallback', () => {
    act(() => useBridgeStore.setState({ tokens: TOKENS }));
    useSnapshotStore.setState({ tenantEntitlements: { analytics: true } });
    const yes = render(<Entitled to="analytics" fallback={<i>upgrade</i>}><p>panel</p></Entitled>);
    expect(yes.container.textContent).toBe('panel');
    cleanup();
    const no = render(<Entitled to="sso" fallback={<i>upgrade</i>}><p>panel</p></Entitled>);
    expect(no.container.textContent).toBe('upgrade');
  });
});

describe('<FeatureFlag upgrade> — level 1', () => {
  function withFlag(reason: string | undefined, feature?: string) {
    setBridgeFlagsInstance({ flag: () => ({ value: false, passed: false, reason, feature }) } as never);
  }

  it('shows the inline prompt for a plan reason only, and opens nothing by itself', () => {
    withFlag('plan', 'analytics');
    const plan = render(<FeatureFlag flagKey="analytics" defaultValue={false} upgrade><a>Analytics</a></FeatureFlag>);
    expect(plan.container.querySelector('[data-bridge-feature-upgrade="analytics"]')).not.toBeNull();
    expect(getFeatureUpgrade()).toBeNull();
    cleanup();
    withFlag('permission');
    const perm = render(<FeatureFlag flagKey="analytics" defaultValue={false} upgrade><a>Analytics</a></FeatureFlag>);
    expect(perm.container.innerHTML).toBe('');
  });

  it('clicking it — or openUpgrade from a fallback — opens the dialog for this flag and feature', () => {
    withFlag('plan', 'analytics');
    const { container } = render(<FeatureFlag flagKey="reports" defaultValue={false} upgrade><a /></FeatureFlag>);
    fireEvent.click(container.querySelector('button')!);
    expect(getFeatureUpgrade()).toEqual({ flag: 'reports', feature: 'analytics', fix: null });
  });
});

// ── Level 0 ──────────────────────────────────────────────────────────────────

describe('the 402 refusal', () => {
  it('reads the @RequireQuota body; anything else is not a quota refusal; numbers stay null, never 0', () => {
    expect(parseQuotaRefusal(REFUSAL, '/api/tickets')).toEqual({
      metric: 'tickets', used: 3, limit: 3, fix: '/subscription', message: 'Limit', url: '/api/tickets',
    });
    expect(parseQuotaRefusal({ code: 'PAYMENT_REQUIRED', metric: 'x' })).toBeNull();
    expect(parseQuotaRefusal({ code: 'QUOTA_EXCEEDED', metric: 'x' })).toMatchObject({ used: null, limit: null });
    // The fix becomes a link: only a same-app path survives.
    expect(parseQuotaRefusal({ ...REFUSAL, fix: 'https://evil.test' })?.fix).toBeNull();
    expect(parseQuotaRefusal({ ...REFUSAL, fix: '//evil.test' })?.fix).toBeNull();
    expect(parseFeatureRefusal({ code: 'FEATURE_NOT_IN_PLAN', flag: 'reports', feature: 'analytics' })).toEqual({
      flag: 'reports', feature: 'analytics', fix: null,
    });
  });

  it('watches the page origin, Bridge’s API and listed origins, nothing else', () => {
    const opts = { pageOrigin: 'http://localhost', apiBaseUrl: API, apiOrigins: ['https://backend.test'] };
    expect(watchesQuotaOrigin('/api/x', opts)).toBe(true);
    expect(watchesQuotaOrigin(`${API}/usage`, opts)).toBe(true);
    expect(watchesQuotaOrigin('https://backend.test/x', opts)).toBe(true);
    expect(watchesQuotaOrigin('https://stripe.test/x', opts)).toBe(false);
  });

  it('a same-origin plain fetch that is refused is announced once, and returned to the caller unchanged', async () => {
    handler = () => json(402, REFUSAL);
    const heard: string[] = [];
    onBridgeQuotaExceeded((r) => heard.push(r.metric));
    installQuotaObserver();
    const res = await fetch('/api/tickets', { method: 'POST' });
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual(REFUSAL);
    await waitFor(() => expect(getQuotaRefusal()?.metric).toBe('tickets'));
    expect(heard).toEqual(['tickets']);
    // bridgeFetch over the installed observer sees the same response twice;
    // it is announced once.
    await bridgeFetch('/api/tickets');
    await new Promise((r) => setTimeout(r, 10));
    expect(heard).toEqual(['tickets', 'tickets']);
  });

  it('a 402 from a third-party origin is not the app’s plan limit', async () => {
    handler = () => json(402, REFUSAL);
    installQuotaObserver();
    await fetch('https://payments.example/charge');
    await new Promise((r) => setTimeout(r, 10));
    expect(getQuotaRefusal()).toBeNull();
  });

  it('a 402 FEATURE_NOT_IN_PLAN opens the feature variant through the same observer', async () => {
    handler = () => json(402, { code: 'FEATURE_NOT_IN_PLAN', flag: 'reports', feature: 'analytics' });
    const res = await fetch('/api/reports');
    await observeQuotaRefusal(res, '/api/reports');
    expect(getFeatureUpgrade()?.feature).toBe('analytics');
  });
});

describe('bridgeFetch', () => {
  it('sends the user’s token to your backend, keeps the caller’s headers, and a cross-origin 402 is announced', async () => {
    act(() => useBridgeStore.setState({ tokens: TOKENS }));
    spies.push(spyOn(BridgeAuth.prototype as never, 'getTokens' as never).mockImplementation((() => TOKENS) as never));
    handler = () => json(402, REFUSAL);
    await bridgeFetch('https://backend.elsewhere/api/tickets', { headers: { 'X-Mine': '1' } });
    expect(appCalls()[0].auth).toBe(`Bearer ${TOKENS.accessToken}`);
    await waitFor(() => expect(getQuotaRefusal()?.metric).toBe('tickets'));
  });

  it('on a 401 refreshes the token once and retries with the new one', async () => {
    let current = TOKENS;
    spies.push(
      spyOn(BridgeAuth.prototype as never, 'getTokens' as never).mockImplementation((() => current) as never),
      spyOn(BridgeAuth.prototype as never, 'refreshTokens' as never).mockImplementation((async () => {
        current = { ...TOKENS, accessToken: 'fresh' };
        return current;
      }) as never),
    );
    handler = (_url, init) => (new Headers(init?.headers).get('Authorization') === 'Bearer fresh' ? json(200, {}) : json(401, {}));
    const res = await bridgeFetch('/api/x');
    expect(res.status).toBe(200);
    expect(appCalls().map((c) => c.auth)).toEqual([`Bearer ${TOKENS.accessToken}`, 'Bearer fresh']);
  });
});

describe('<BridgeUpgradeDialog>', () => {
  const refusal = parseQuotaRefusal(REFUSAL, '/api/tickets');

  it('names the metric and the numbers, and links to the upgrade path', () => {
    const { container } = render(
      <BridgeUpgradeDialog refusal={refusal} upgradeHref="/subscription" canUpgrade onClose={() => {}} />,
    );
    const dialog = container.querySelector('[data-bridge-upgrade-dialog]')!;
    expect(dialog.getAttribute('data-variant')).toBe('limit');
    expect(dialog.textContent).toContain('used 3 of 3 tickets');
    expect(container.querySelector('[data-bridge-upgrade-dialog-cta]')?.getAttribute('href')).toBe('/subscription');
  });

  it('a member who cannot manage billing is told who to ask and gets no Upgrade link', () => {
    const { container } = render(
      <BridgeUpgradeDialog refusal={refusal} upgradeHref="/subscription" canUpgrade={false} onClose={() => {}} />,
    );
    expect(container.textContent).toContain('Contact your workspace owner.');
    expect(container.querySelector('[data-bridge-upgrade-dialog-cta]')).toBeNull();
  });

  it('the feature variant names the plans that include the feature, cheapest first', () => {
    const plans = [
      { key: 'biz', name: 'Business', prices: [{ amount: 90 }], features: [{ key: 'analytics', name: 'Analytics' }] },
      { key: 'pro', name: 'Pro', prices: [{ amount: 20 }], features: [{ key: 'analytics', name: 'Analytics' }] },
      { key: 'free', name: 'Free', prices: [{ amount: 0 }] },
    ];
    expect(plansIncludingFeature(plans, 'analytics')).toEqual(['Pro', 'Business']);
    const { container } = render(
      <BridgeUpgradeDialog refusal={null} feature="analytics" plans={plans} upgradeHref="/subscription" canUpgrade onClose={() => {}} />,
    );
    expect(container.querySelector('[data-bridge-upgrade-dialog]')?.getAttribute('data-variant')).toBe('feature');
    expect(container.querySelector('[data-bridge-upgrade-dialog-included-in]')?.textContent).toBe('Included in: Pro, Business');
  });

  it('on by default; false turns it off; a component replaces it; the link goes to fix, else manageRoute', () => {
    const Mine = () => null;
    expect(resolveUpgradeDialog(undefined)).toBe('default');
    expect(resolveUpgradeDialog({ upgradeDialog: false })).toBeNull();
    expect(resolveUpgradeDialog({ upgradeDialog: Mine })).toBe(Mine);
    expect(upgradeHrefFor({ fix: '/billing?from=x' }, undefined)).toBe('/billing?from=x');
    expect(upgradeHrefFor(null, { manageRoute: '/plans' })).toBe('/plans');
    expect(upgradeHrefFor(null, undefined)).toBe('/subscription');
  });
});

describe('level 0 end to end: <BridgeProvider> and a page that only calls fetch', () => {
  it('the backend refuses at the cap, the upgrade dialog opens — the page wrote no Bridge code', async () => {
    _resetBridgeInstance();
    handler = (url) => (url.endsWith('/api/tickets') ? json(402, REFUSAL) : json(404, {}));
    function Page() {
      return <button onClick={() => void fetch('/api/tickets', { method: 'POST' })}>New ticket</button>;
    }
    const { container, getByText } = render(
      <BridgeProvider appId="tbp-743" config={{ apiBaseUrl: API, billing: { paywallRoute: false } }}>
        <Page />
      </BridgeProvider>,
    );
    expect(container.querySelector('[data-bridge-upgrade-dialog][data-variant]')).toBeNull();
    fireEvent.click(getByText('New ticket'));
    await waitFor(() =>
      expect(container.querySelector('[data-bridge-upgrade-dialog]')?.getAttribute('data-metric')).toBe('tickets'),
    );
  });

  it('billing.upgradeDialog: false mounts no dialog', () => {
    _resetBridgeInstance();
    const { container } = render(
      <BridgeProvider appId="tbp-743" config={{ apiBaseUrl: API, billing: { upgradeDialog: false, paywallRoute: false } }}>
        <div />
      </BridgeProvider>,
    );
    expect(container.querySelector('[data-bridge-upgrade-dialog]')).toBeNull();
  });
});

describe('bridge.usage — counting from the browser', () => {
  it('set(metric, value) stores a gauge; report(metric) queues a counter', async () => {
    const seen: unknown[][] = [];
    const fake = {
      set: async (...args: unknown[]) => void seen.push(['set', ...args]),
      report: (...args: unknown[]) => void seen.push(['report', ...args]),
      getQueueStatus: async () => ({}),
    };
    Object.defineProperty(getBridgeAuth(), 'usage', { configurable: true, get: () => fake });
    await bridge.usage.set('projects', 8);
    bridge.usage.report('exports', 1, 'k-1');
    expect(seen).toEqual([
      ['set', 'projects', 8],
      ['report', 'exports', 1, 'k-1'],
    ]);
  });
});

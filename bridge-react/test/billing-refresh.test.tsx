/**
 * TBP-762 — the billing screens stay current without a reload.
 *
 * Regression (bridge-react 0.9.0): the plan list and the billing state were
 * read once, when a screen first mounted, and never again. A plan created,
 * changed or removed in Bridge did not appear on an open plan picker until a
 * reload, and a live subscription or payment event moved nothing but the
 * event bus. bridge-svelte re-reads both on one rule (`core/billing-store.ts`):
 * a renewed sign-in, a live billing event, and tab focus after 30 s; a failed
 * or empty read is retried once; a re-read never blanks the screen. This is
 * the React port. Bridge itself is faked: only the network and the auth-core
 * calls are replaced.
 *
 * Revert-proof: on 0.9.0 there is no focus or visibility handler, no
 * `startBillingRefresh`, the runtime's billing handlers only dispatch, and
 * `loadSubscription()` neither shares reads nor retries.
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { BridgeAuth, useBridge, type Plan, type WebSocketLike } from '@nebulr-group/bridge-auth-core';
import { PlanSelector } from '../src/components/subscription/PlanSelector';
import { BridgeSubscriptionStatus } from '../src/components/subscription/BridgeSubscriptionStatus';
import {
  __setBillingRetryDelay,
  _resetBridgeInstance,
  getBridgeAuth,
  initBridge,
  loadSubscription,
  useBridgeStore,
} from '../src/core/bridge-instance';
import { __resetBillingRefreshForTests, startBillingRefresh } from '../src/core/billing-refresh';
import { __resetBillingStateForTests } from '../src/core/billing-state';
import { __resetBridgeRuntime, startBridgeRuntime, stopBridgeRuntime } from '../src/core/bridge-runtime';
import { __resetStartupReadsForTests } from '../src/core/startup-reads';

const API = 'http://api.test.local';

const plan = (key: string, name: string, amount: number) =>
  ({
    key,
    name,
    trial: false,
    prices: [{ id: `${key}-m`, amount, currency: 'usd', recurrenceInterval: 'month' }],
  }) as unknown as Plan;

const FREE = plan('free', 'Free', 0);
const PRO = plan('pro', 'Pro', 20);
const TEAM = plan('team', 'Team', 50);

// What the fake Bridge answers right now. Tests change it to simulate an edit
// made in the Bridge dashboard while the app is open.
let serverPlans: Plan[];
let serverBillingPlan: { slug: string; name: string };
let plansFail: boolean;
let token: string | null;
let planReads: number;
let billingReads: number;
let now: number;
let originalFetch: typeof fetch;
const spies: Array<{ mockRestore(): void }> = [];
let stops: Array<() => void> = [];

function advance(ms: number): void {
  now += ms;
}

async function focusTab(): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new Event('focus'));
  });
}

beforeEach(() => {
  __resetBridgeRuntime();
  _resetBridgeInstance();
  __resetBillingStateForTests();
  __resetStartupReadsForTests();
  __setBillingRetryDelay(0);
  initBridge({ appId: 'app-1', apiBaseUrl: API } as never);
  useBridge().subscription.hydrate(null as never); // no billing read yet

  serverPlans = [FREE, PRO];
  serverBillingPlan = { slug: 'free', name: 'Free' };
  plansFail = false;
  token = 'tok-1';
  planReads = 0;
  billingReads = 0;
  now = 1_000_000;
  useBridgeStore.setState({ tokens: { accessToken: token, refreshToken: 'r' } as never });

  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname === '/billing/state') {
      billingReads += 1;
      return new Response(JSON.stringify({ plan: serverBillingPlan, status: 'active' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.pathname === '/realtime/config') {
      return new Response(JSON.stringify({ kind: 'noop' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 404 });
  }) as typeof fetch;

  const auth = getBridgeAuth();
  const proto = BridgeAuth.prototype as unknown as Record<string, unknown>;
  spies.push(
    spyOn(Date, 'now').mockImplementation(() => now),
    spyOn(console, 'warn').mockImplementation(() => {}),
    spyOn(auth, 'getApiContext').mockImplementation((() => ({ apiBaseUrl: API, appId: 'app-1', accessToken: token })) as never),
    spyOn(proto as never, 'getSubscriptionStatus' as never).mockImplementation((async () => ({ plan: 'free' })) as never),
    spyOn(proto as never, 'getPlans' as never).mockImplementation((async () => {
      planReads += 1;
      if (plansFail) throw new Error('network down');
      return [...serverPlans];
    }) as never),
  );
});

afterEach(async () => {
  cleanup();
  for (const stop of stops.splice(0)) stop();
  __resetBillingRefreshForTests();
  for (const spy of spies.splice(0)) spy.mockRestore();
  globalThis.fetch = originalFetch;
  await stopBridgeRuntime();
  __resetBridgeRuntime();
  __resetBillingStateForTests();
  _resetBridgeInstance();
});

describe('the plan picker stays current (TBP-762)', () => {
  it('a plan added in Bridge appears when the tab regains focus after 30 s, without a reload', async () => {
    stops.push(startBillingRefresh());
    const { container } = render(<PlanSelector />);
    await waitFor(() => expect(container.textContent).toContain('Pro'));
    expect(container.textContent).not.toContain('Team');

    serverPlans = [FREE, PRO, TEAM]; // the owner adds "Team" in the Bridge dashboard
    advance(31_000);
    await focusTab();

    await waitFor(() => expect(container.textContent).toContain('Team'));
  });

  it('a focus within 30 s of the last read does not read again', async () => {
    stops.push(startBillingRefresh());
    render(<PlanSelector />);
    await waitFor(() => expect(planReads).toBe(1));
    advance(5_000);
    await focusTab();
    await new Promise((r) => setTimeout(r, 10));
    expect(planReads).toBe(1);
  });

  it('a renewed sign-in re-reads the plan list', async () => {
    stops.push(startBillingRefresh());
    const { container } = render(<PlanSelector />);
    await waitFor(() => expect(planReads).toBe(1));

    serverPlans = [FREE, PRO, TEAM];
    token = 'tok-2';
    act(() => useBridgeStore.setState({ tokens: { accessToken: token, refreshToken: 'r' } as never }));

    await waitFor(() => expect(container.textContent).toContain('Team'));
  });

  it('an app that never showed a billing screen makes no billing reads on focus', async () => {
    stops.push(startBillingRefresh());
    advance(60_000);
    await focusTab();
    await new Promise((r) => setTimeout(r, 10));
    expect(planReads).toBe(0);
    expect(billingReads).toBe(0);
  });
});

describe('the subscription badge stays current (TBP-762)', () => {
  it('re-reads the billing state on focus after 30 s and swaps the plan without a "Loading…" flash', async () => {
    stops.push(startBillingRefresh());
    const { container } = render(<BridgeSubscriptionStatus />);
    await waitFor(() => expect(container.querySelector('.bss-plan')?.textContent).toBe('Free'));

    const seenLoading: boolean[] = [];
    const off = useBridge().subscription.subscribe((s) => seenLoading.push(s.loading));
    serverBillingPlan = { slug: 'pro', name: 'Pro' };
    advance(31_000);
    await focusTab();

    await waitFor(() => expect(container.querySelector('.bss-plan')?.textContent).toBe('Pro'));
    off();
    expect(seenLoading.includes(true)).toBe(false);
  });
});

describe('live billing events re-read the billing screens (TBP-762)', () => {
  /** A socket that never opens — the test drives the billing handlers directly. */
  class InertWebSocket implements WebSocketLike {
    readyState = 0;
    onopen: ((ev: unknown) => void) | null = null;
    onclose: ((ev: unknown) => void) | null = null;
    onerror: ((ev: unknown) => void) | null = null;
    onmessage: ((ev: { data: unknown }) => void) | null = null;
    send(): void {}
    close(): void {
      this.readyState = 3;
    }
  }

  for (const kind of ['subscription.updated', 'subscription.created', 'payment.succeeded', 'subscription.plan_changed']) {
    it(`${kind} re-reads the plan list and the billing state`, async () => {
      let handlers: Record<string, (msg: unknown) => void> = {};
      const billingBridge = useBridge();
      spies.push(
        spyOn(billingBridge, 'handle').mockImplementation(((h: Record<string, (msg: unknown) => void>) => {
          handlers = h;
          return () => {};
        }) as never),
        spyOn(billingBridge, 'attachToRealtimeClient').mockImplementation((() => {}) as never),
      );
      startBridgeRuntime({
        realtime: { websocketFactory: () => new InertWebSocket(), reportStatus: false, diagnose: false } as never,
      });

      const picker = render(<PlanSelector />);
      const badge = render(<BridgeSubscriptionStatus />);
      await waitFor(() => expect(badge.container.querySelector('.bss-plan')?.textContent).toBe('Free'));
      await waitFor(() => expect(planReads).toBe(1));
      const billingBefore = billingReads;

      serverPlans = [FREE, PRO, TEAM];
      serverBillingPlan = { slug: 'pro', name: 'Pro' };
      await act(async () => {
        handlers[kind]({ kind, tenantId: 'ws-1', to: { slug: 'pro', name: 'Pro' }, status: 'active' });
      });

      await waitFor(() => expect(picker.container.textContent).toContain('Team'));
      await waitFor(() => expect(badge.container.querySelector('.bss-plan')?.textContent).toBe('Pro'));
      expect(billingReads).toBeGreaterThan(billingBefore);
    });
  }
});

describe('loadSubscription(): one read, retried once, never blanks the screen (TBP-762)', () => {
  it('concurrent calls share one read, and a call during a read gets one more after it', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const proto = BridgeAuth.prototype as unknown as Record<string, unknown>;
    spies.push(
      spyOn(proto as never, 'getPlans' as never).mockImplementation((async () => {
        planReads += 1;
        await gate;
        return [FREE, PRO];
      }) as never),
    );
    const a = loadSubscription();
    const b = loadSubscription();
    const c = loadSubscription();
    release();
    await Promise.all([a, b, c]);
    expect(planReads).toBe(2);
  });

  it('an empty plan list is asked for once more before it is believed', async () => {
    let answers = [[], [FREE, PRO]];
    const proto = BridgeAuth.prototype as unknown as Record<string, unknown>;
    spies.push(
      spyOn(proto as never, 'getPlans' as never).mockImplementation((async () => {
        planReads += 1;
        return answers.shift() ?? [];
      }) as never),
    );
    await loadSubscription();
    expect(planReads).toBe(2);
    expect(useBridgeStore.getState().subscription.plans?.map((p) => p.key)).toEqual(['free', 'pro']);
    answers = [];
  });

  it('a failed re-read keeps the last good plan list on screen, with no loading state', async () => {
    await loadSubscription();
    expect(useBridgeStore.getState().subscription.plans).toHaveLength(2);

    plansFail = true;
    const seenLoading: boolean[] = [];
    const off = useBridgeStore.subscribe((s) => seenLoading.push(s.subscription.loading));
    await loadSubscription();
    off();

    const sub = useBridgeStore.getState().subscription;
    expect(sub.plans).toHaveLength(2);
    expect(sub.error).toBeNull();
    expect(seenLoading.includes(true)).toBe(false);
    expect(planReads).toBe(3); // the first read, then the failed re-read and its one retry
  });

  it('a first read that fails twice shows the error', async () => {
    plansFail = true;
    await loadSubscription();
    expect(planReads).toBe(2);
    expect(useBridgeStore.getState().subscription.error).toBe('network down');
  });

  it('an answer that arrives after sign-out is dropped', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const proto = BridgeAuth.prototype as unknown as Record<string, unknown>;
    spies.push(
      spyOn(proto as never, 'getPlans' as never).mockImplementation((async () => {
        await gate;
        return [FREE, PRO];
      }) as never),
    );
    const read = loadSubscription();
    (getBridgeAuth() as unknown as { emitter: { emit(e: string, p?: unknown): void } }).emitter.emit('auth:logout');
    release();
    await read;
    expect(useBridgeStore.getState().subscription.plans).toBeNull();
  });
});

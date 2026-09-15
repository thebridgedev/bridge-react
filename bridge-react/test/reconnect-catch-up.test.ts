/**
 * TBP-660 — every realtime reconnect, including the one reauthorize() causes,
 * re-fetches billing state once so a push lost during the socket swap is
 * repaired.
 *
 * Regression: on a plan change the server sends `user.state_changed` before
 * `subscription.plan_changed`. The SDK refreshes the token, the new token
 * reauthorizes, and reauthorize() replaces the socket. AppSync has no replay,
 * so a plan push published during the swap was lost, and a reconnect the SDK
 * caused itself ran no catch-up of any kind: the page stayed on the old plan
 * (1 of 8 stage runs against bridge-svelte, which shares this wiring).
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { RealtimeClient, useBridge, type WebSocketLike } from '@nebulr-group/bridge-auth-core';
import { bridge, type BridgeReadable } from '../src/core/bridge';
import {
  __resetBridgeRuntime,
  onBridgeAuthorizationChange,
  startBridgeRuntime,
  stopBridgeRuntime,
  type BridgeAuthorizationChangeReason,
} from '../src/core/bridge-runtime';
import { _resetBridgeInstance, getBridgeAuth, initBridge, useBridgeStore } from '../src/core/bridge-instance';
import { __resetSnapshotStores, applySessionSnapshot } from '../src/core/snapshot-stores';

// ── Harness ─────────────────────────────────────────────────────────────────

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

const API = 'http://api.test.local';
const realtimeFetch = (async (url: string) => {
  const ok = new URL(url).pathname === '/realtime/config';
  const body = ok ? { kind: 'appsync', endpoint: 'svc.appsync-realtime-api.eu-west-1.amazonaws.com' } : {};
  return { ok, status: ok ? 200 : 404, json: async () => body };
}) as unknown as typeof fetch;

function jwt(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  return `${b64({ alg: 'none' })}.${b64(claims)}.sig`;
}
const TOKEN_A = jwt({ sub: 'user-1', tid: 'ws-1', aid: 'app-1', plan: 'free' });
const TOKEN_B = jwt({ sub: 'user-1', tid: 'ws-1', aid: 'app-1', plan: 'pro' });

function setToken(accessToken: string | null): void {
  useBridgeStore.setState({ tokens: accessToken ? { accessToken, refreshToken: 'r' } : null } as never);
}

const PRO = { plan: { slug: 'pro', name: 'Pro' }, status: 'active' };
const FREE = { plan: { slug: 'free', name: 'Free' }, status: 'active' };

function read<T>(r: BridgeReadable<T>): T {
  let value!: T;
  r.subscribe((v) => {
    value = v;
  })();
  return value;
}
const tenantPlan = () => read(bridge.tenant.subscription)?.plan.slug;
const billingPlan = () => useBridge().subscription.snapshot().state?.plan.slug;
const flush = () => new Promise((r) => setTimeout(r, 0));

// ── Fixture ─────────────────────────────────────────────────────────────────

let open: () => void;
let billingFetches: string[] = [];
/** Next responses for GET /billing/state, in call order. */
let billingResponses: Array<() => Promise<{ status: number; body: unknown }>> = [];
let refreshes = 0;
let reauthorizes = 0;
const spies: Array<{ mockRestore(): void }> = [];

function respondWith(status: number, body: unknown) {
  return () => Promise.resolve({ status, body });
}

function start(seed: string | null): void {
  setToken(seed);
  startBridgeRuntime({
    realtime: { websocketFactory: () => new InertWebSocket(), fetchFn: realtimeFetch, reportStatus: false, diagnose: false },
  });
}

beforeEach(() => {
  __resetBridgeRuntime();
  _resetBridgeInstance();
  __resetSnapshotStores();
  initBridge({ appId: 'app-1', apiBaseUrl: API } as never);
  billingFetches = [];
  billingResponses = [];
  refreshes = 0;
  reauthorizes = 0;

  const auth = getBridgeAuth();
  spies.push(
    spyOn(auth, 'refreshTokens').mockImplementation((async () => {
      refreshes += 1;
      return null;
    }) as never),
    spyOn(auth, 'invalidateFeatureFlagCache').mockImplementation(() => {}),
  );
  const billingBridge = useBridge();
  spies.push(
    spyOn(billingBridge, 'handle').mockImplementation((() => () => {}) as never),
    spyOn(billingBridge, 'attachToRealtimeClient').mockImplementation((() => {}) as never),
    spyOn(RealtimeClient.prototype, 'setOnOpen').mockImplementation(function (this: RealtimeClient, h: () => void) {
      open = h;
    } as never),
    spyOn(RealtimeClient.prototype, 'reauthorize').mockImplementation((async () => {
      reauthorizes += 1;
    }) as never),
    spyOn(globalThis, 'fetch').mockImplementation((async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (!url.endsWith('/billing/state')) {
        return new Response('{}', { status: 404 });
      }
      billingFetches.push(String((init?.headers as Record<string, string>)?.Authorization ?? ''));
      const next = billingResponses.shift() ?? respondWith(200, PRO);
      const { status, body } = await next();
      return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    }) as never),
  );
  // Start from a known billing baseline on both surfaces.
  useBridge().subscription.hydrate(FREE as never);
  applySessionSnapshot({ tenant: { id: 'ws-1', subscription: FREE } } as never);
});

afterEach(async () => {
  for (const spy of spies.splice(0)) spy.mockRestore();
  await stopBridgeRuntime();
  __resetBridgeRuntime();
  _resetBridgeInstance();
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('billing catch-up after a realtime reconnect (TBP-660)', () => {
  it('a reconnect caused by reauthorize() fetches once and repairs both subscription surfaces', async () => {
    start(TOKEN_A);
    open(); // initial connect
    await flush();
    expect(billingFetches).toHaveLength(0);

    // user.state_changed → refreshed token → reauthorize → socket swap. The
    // plan push published during the swap never arrives.
    setToken(TOKEN_B);
    expect(reauthorizes).toBe(1);
    open();
    await flush();

    expect(billingFetches).toEqual([`Bearer ${TOKEN_B}`]); // one fetch, with the socket's current token
    expect(tenantPlan()).toBe('pro');
    expect(billingPlan()).toBe('pro');
    // Loop guard intact: no token catch-up for a self-induced reconnect, and
    // the billing catch-up caused no further reauthorize.
    expect(refreshes).toBe(0);
    expect(reauthorizes).toBe(1);
  });

  it('a genuine reconnect keeps its token catch-up and also repairs billing once', async () => {
    start(TOKEN_A);
    open();
    open(); // network blip
    await flush();

    expect(refreshes).toBe(1);
    expect(billingFetches).toHaveLength(1);
    expect(tenantPlan()).toBe('pro');
  });

  it('one fetch per reconnect — no storm', async () => {
    start(TOKEN_A);
    open();
    open();
    await flush();
    open();
    await flush();
    open();
    await flush();
    expect(billingFetches).toHaveLength(3);
  });

  it('drops gate caches after the catch-up lands, so a plan-gated route re-evaluates', async () => {
    start(TOKEN_A);
    const reasons: BridgeAuthorizationChangeReason[] = [];
    const off = onBridgeAuthorizationChange((r) => reasons.push(r));
    open();
    open();
    await flush();
    off();
    expect(reasons).toEqual(['reconnect']);
  });

  it('the first open is not a reconnect', async () => {
    start(TOKEN_A);
    open();
    await flush();
    expect(billingFetches).toHaveLength(0);
    expect(tenantPlan()).toBe('free');
  });

  it('a signed-out session has no workspace billing to fetch', async () => {
    start(null);
    open();
    open();
    await flush();
    expect(billingFetches).toHaveLength(0);
  });

  it('a failed catch-up leaves both surfaces alone and does not throw', async () => {
    start(TOKEN_A);
    billingResponses.push(respondWith(500, { message: 'boom' }));
    open();
    open();
    await flush();
    expect(billingFetches).toHaveLength(1);
    expect(tenantPlan()).toBe('free');
    expect(billingPlan()).toBe('free');
  });

  it('a superseded catch-up never overwrites a newer one', async () => {
    start(TOKEN_A);
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((r) => {
      releaseFirst = r;
    });
    // First reconnect's fetch is slow and returns the pre-change plan; the
    // second reconnect's fetch returns the new plan and lands first.
    billingResponses.push(async () => {
      await firstGate;
      return { status: 200, body: FREE };
    });
    billingResponses.push(respondWith(200, PRO));
    open();
    open(); // reconnect 1
    open(); // reconnect 2
    await flush();
    expect(tenantPlan()).toBe('pro');

    releaseFirst();
    await flush();
    await flush();
    expect(billingFetches).toHaveLength(2);
    expect(tenantPlan()).toBe('pro');
    expect(billingPlan()).toBe('pro');
  });

  it('a catch-up in flight when the runtime stops applies nothing', async () => {
    start(TOKEN_A);
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    billingResponses.push(async () => {
      await gate;
      return { status: 200, body: PRO };
    });
    open();
    open();
    await flush();
    await stopBridgeRuntime();
    release();
    await flush();
    await flush();
    expect(tenantPlan()).toBe('free');
    expect(billingPlan()).toBe('free');
  });
});

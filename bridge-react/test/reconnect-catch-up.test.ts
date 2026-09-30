/**
 * TBP-660 — every realtime reconnect, including the one reauthorize() causes,
 * re-fetches billing state once so a push lost during the socket swap is
 * repaired. TBP-686 — and so does the first connect, which also re-reads the
 * session snapshot and every hydrated quota metric.
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

type Answer = () => Promise<{ status: number; body: unknown }>;

/** The transport finished (re)connecting: `open`, then every channel subscribed. */
let open: () => void;
let openHook: (() => void) | undefined;
let subscribedHook: (() => void) | undefined;
let billingFetches: string[] = [];
/** Every catch-up request, as `path` (+ its Authorization / x-app-id headers). */
let calls: Array<{ path: string; auth: string; appId: string }> = [];
/** Next responses for GET /billing/state, in call order. */
let billingResponses: Answer[] = [];
/** Next responses for GET /session/init; empty → 404 (no snapshot to apply). */
let sessionResponses: Answer[] = [];
/** Next responses for GET /usage/quota/:metric, per metric. */
let quotaResponses: Record<string, Answer[]> = {};
let refreshes = 0;
/** The options every refreshTokens() call was made with. */
let refreshOptions: Array<{ fresh?: boolean } | undefined> = [];
/** What the next refreshTokens() calls resolve to. */
let refreshResult: () => { accessToken: string; refreshToken: string } | null = () => null;
let reauthorizes = 0;
const spies: Array<{ mockRestore(): void }> = [];

function respondWith(status: number, body: unknown): Answer {
  return () => Promise.resolve({ status, body });
}

/** A response that waits for `release()`. */
function gated(status: number, body: unknown): { answer: Answer; release: () => void } {
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  return {
    answer: async () => {
      await gate;
      return { status, body };
    },
    release,
  };
}

// TBP-686 — the first connect catches up too. By default the server agrees
// with the page's baseline (FREE), so that first round changes nothing and
// the reconnect cases below measure only what their reconnect recovered.
function start(seed: string | null): void {
  setToken(seed);
  billingResponses.push(respondWith(200, FREE));
  startBridgeRuntime({
    realtime: { websocketFactory: () => new InertWebSocket(), fetchFn: realtimeFetch, reportStatus: false, diagnose: false },
  });
}

/** Let a round and any follow-up it queued run to completion. */
async function settle(): Promise<void> {
  for (let i = 0; i < 6; i++) await flush();
}

beforeEach(() => {
  __resetBridgeRuntime();
  _resetBridgeInstance();
  __resetSnapshotStores();
  useBridge().quotas.__resetForTests();
  useBridge().entitlementsStore.__resetForTests();
  initBridge({ appId: 'app-1', apiBaseUrl: API } as never);
  openHook = undefined;
  subscribedHook = undefined;
  open = () => {
    openHook?.();
    subscribedHook?.();
  };
  billingFetches = [];
  calls = [];
  billingResponses = [];
  sessionResponses = [];
  quotaResponses = {};
  refreshes = 0;
  refreshOptions = [];
  refreshResult = () => null;
  reauthorizes = 0;

  const auth = getBridgeAuth();
  spies.push(
    spyOn(auth, 'refreshTokens').mockImplementation((async (options?: { fresh?: boolean }) => {
      refreshes += 1;
      refreshOptions.push(options);
      return refreshResult();
    }) as never),
    spyOn(auth, 'invalidateFeatureFlagCache').mockImplementation(() => {}),
  );
  const billingBridge = useBridge();
  spies.push(
    spyOn(billingBridge, 'handle').mockImplementation((() => () => {}) as never),
    spyOn(billingBridge, 'attachToRealtimeClient').mockImplementation((() => {}) as never),
    spyOn(RealtimeClient.prototype, 'setOnOpen').mockImplementation(function (this: RealtimeClient, h: () => void) {
      openHook = h;
    } as never),
    // TBP-700 — auth-core 0.8 says when every channel is subscribed; the
    // catch-up runs then, not on the first ack.
    spyOn(RealtimeClient.prototype, 'setOnSubscribed').mockImplementation(function (this: RealtimeClient, h: () => void) {
      subscribedHook = h;
    } as never),
    spyOn(RealtimeClient.prototype, 'reauthorize').mockImplementation((async () => {
      reauthorizes += 1;
    }) as never),
    spyOn(globalThis, 'fetch').mockImplementation((async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      const headers = (init?.headers ?? {}) as Record<string, string>;
      calls.push({ path, auth: String(headers.Authorization ?? ''), appId: String(headers['x-app-id'] ?? '') });
      let next: Answer | undefined;
      if (path === '/billing/state') {
        billingFetches.push(String(headers.Authorization ?? ''));
        next = billingResponses.shift() ?? respondWith(200, PRO);
      } else if (path === '/session/init') {
        next = sessionResponses.shift();
      } else if (path.startsWith('/usage/quota/')) {
        next = quotaResponses[decodeURIComponent(path.slice('/usage/quota/'.length))]?.shift();
      }
      if (!next) return new Response('{}', { status: 404 });
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
    open(); // initial connect — catches up too (TBP-686), finds the same plan
    await settle();
    expect(billingFetches).toEqual([`Bearer ${TOKEN_A}`]);

    // user.state_changed → refreshed token → reauthorize → socket swap. The
    // plan push published during the swap never arrives.
    setToken(TOKEN_B);
    expect(reauthorizes).toBe(1);
    open();
    await settle();

    // One fetch for the reconnect, with the socket's current token.
    expect(billingFetches).toEqual([`Bearer ${TOKEN_A}`, `Bearer ${TOKEN_B}`]);
    expect(tenantPlan()).toBe('pro');
    expect(billingPlan()).toBe('pro');
    // TBP-700 — one reconcile per round (first connect + this reconnect),
    // and that reconcile IS the token carrying the recovered plan change
    // (TBP-654): no second refresh for it, and no further reauthorize.
    expect(refreshes).toBe(2);
    expect(reauthorizes).toBe(1);
  });

  it('TBP-654 — a recovered plan change costs no refresh beyond the round\'s own reconcile, so it cannot loop', async () => {
    start(TOKEN_A);
    open();
    setToken(TOKEN_B);
    open(); // self-induced; folded into one follow-up round that recovers free → pro
    await settle();
    expect(refreshes).toBe(2); // one reconcile per round, nothing more

    // That token reauthorizes; its reconnect catches up again and finds pro,
    // which the page already has.
    setToken(jwt({ sub: 'user-1', tid: 'ws-1', aid: 'app-1', plan: 'pro', v: 3 }));
    open();
    await settle();
    expect(billingFetches).toHaveLength(3); // first connect + two reconnects
    expect(refreshes).toBe(3);
  });

  it('a genuine reconnect keeps its token catch-up and also repairs billing once', async () => {
    start(TOKEN_A);
    open();
    open(); // network blip
    await settle();

    expect(refreshes).toBe(2); // each connect reconciles once (TBP-700)
    expect(billingFetches).toHaveLength(2); // first connect + the reconnect
    expect(tenantPlan()).toBe('pro');
  });

  it('an open storm costs one follow-up round, not one per open', async () => {
    start(TOKEN_A);
    open(); // first connect — round in flight
    open();
    open();
    open(); // three reconnects meanwhile fold into ONE follow-up
    await settle();
    expect(billingFetches).toHaveLength(2);

    open(); // a later reconnect, nothing in flight → its own round
    await settle();
    expect(billingFetches).toHaveLength(3);
  });

  it('drops gate caches after the catch-up lands, so a plan-gated route re-evaluates', async () => {
    start(TOKEN_A);
    const reasons: BridgeAuthorizationChangeReason[] = [];
    const off = onBridgeAuthorizationChange((r) => reasons.push(r));
    open();
    open();
    await settle();
    off();
    expect(reasons).toEqual(['reconnect']);
  });

  it('TBP-654 — a reconnect that recovers plan A → B still refreshes, and reports a reconnect', async () => {
    start(TOKEN_A);
    open();
    await settle();
    expect(refreshes).toBe(1); // the first connect's reconcile
    const reasons: BridgeAuthorizationChangeReason[] = [];
    const off = onBridgeAuthorizationChange((r) => reasons.push(r));
    setToken(TOKEN_B);
    reasons.length = 0; // the token change itself reports 'token'
    open(); // self-induced reconnect — its reconcile carries the plan the catch-up finds
    await settle();
    off();
    expect(tenantPlan()).toBe('pro');
    expect(reasons).toEqual(['reconnect']);
    expect(refreshes).toBe(2);
  });

  it('a signed-out session has no workspace billing to fetch', async () => {
    start(null);
    open();
    open();
    await settle();
    expect(billingFetches).toHaveLength(0);
  });

  it('a failed catch-up leaves both surfaces alone and does not throw', async () => {
    start(TOKEN_A);
    billingResponses.push(respondWith(500, { message: 'boom' }));
    open();
    open();
    await settle();
    expect(billingFetches).toHaveLength(2);
    expect(tenantPlan()).toBe('free');
    expect(billingPlan()).toBe('free');
  });

  it('a follow-up folded behind a slow round runs after it, so the newest answer wins', async () => {
    start(TOKEN_A);
    // The first round's answer is slow and pre-change; the follow-up's is the
    // new plan. Rounds are serialized, so the older answer can never land last.
    const slow = gated(200, FREE);
    billingResponses[0] = slow.answer;
    billingResponses.push(respondWith(200, PRO));
    open();
    open(); // reconnect 1
    open(); // reconnect 2 — folded with reconnect 1
    await settle();
    expect(billingFetches).toHaveLength(1);

    slow.release();
    await settle();
    expect(billingFetches).toHaveLength(2);
    expect(tenantPlan()).toBe('pro');
    expect(billingPlan()).toBe('pro');
  });

  it('a catch-up in flight when the runtime stops applies nothing, and its queued follow-up never fires', async () => {
    start(TOKEN_A);
    open();
    await settle();
    const slow = gated(200, PRO);
    billingResponses.push(slow.answer);
    open(); // reconnect — round in flight
    open(); // …and a follow-up queued behind it
    await flush();
    await stopBridgeRuntime();
    slow.release();
    await settle();
    expect(billingFetches).toHaveLength(2);
    expect(tenantPlan()).toBe('free');
    expect(billingPlan()).toBe('free');
  });
});

// TBP-686 — regression: the catch-up was gated on `_connectedOnce`, so the
// first connect never ran it. The server publishes `session.snapshot`
// fire-and-forget during authorize, before the subscription is live, so on a
// first connect it routinely loses the race and nothing replays it: tenant
// id/name, branding and the snapshot user stayed null all session. Separately,
// auth-core's QuotaStore never re-reads a metric after its first hydrate, so a
// `quota.updated` push lost across a socket swap froze `used` for the session.
describe('the first connect catches up too (TBP-686)', () => {
  const SNAPSHOT = {
    app: { branding: { logo: 'logo.png', name: 'App' } },
    tenant: {
      id: 'ws-1',
      name: 'Workspace One',
      subscription: FREE,
      entitlements: { pro_page: false },
    },
    user: { id: 'user-1', role: 'OWNER', tenantId: 'ws-1' },
  };
  const quota = (metric: string, used: number) => ({ metric, used, limit: 100, remaining: 100 - used });
  const quotaCalls = () => calls.filter((c) => c.path.startsWith('/usage/quota/')).map((c) => c.path);

  it('fetches /session/init with the socket token and fills tenant id and name', async () => {
    __resetSnapshotStores(); // the snapshot push lost the race: nothing landed
    sessionResponses.push(respondWith(200, SNAPSHOT));
    start(TOKEN_A);
    const reasons: BridgeAuthorizationChangeReason[] = [];
    const off = onBridgeAuthorizationChange((r) => reasons.push(r));
    open();
    await settle();
    off();

    const session = calls.filter((c) => c.path === '/session/init');
    expect(session).toEqual([{ path: '/session/init', auth: `Bearer ${TOKEN_A}`, appId: 'app-1' }]);
    expect(read(bridge.tenant.id)).toBe('ws-1');
    expect(read(bridge.tenant.name)).toBe('Workspace One');
    expect(read(bridge.app.branding)?.name).toBe('App');
    expect(read(bridge.user)?.id).toBe('user-1');
    expect(tenantPlan()).toBe('free');
    // Filling empty slices is hydration, exactly what the lost push would have
    // done — and a delivered push neither notifies nor refreshes. The one
    // refresh is the connect's user-state reconcile (TBP-700).
    expect(reasons).toEqual([]);
    expect(refreshes).toBe(1);
    expect(reauthorizes).toBe(0);
  });

  it('billing state filling an empty subscription is hydration too — no change, no refresh', async () => {
    __resetSnapshotStores(); // no snapshot, and /session/init answers nothing
    start(TOKEN_A);
    const reasons: BridgeAuthorizationChangeReason[] = [];
    const off = onBridgeAuthorizationChange((r) => reasons.push(r));
    open();
    await settle();
    off();
    expect(tenantPlan()).toBe('free'); // the billing half filled it
    expect(reasons).toEqual([]);
    expect(refreshes).toBe(1); // the reconcile only, nothing for the hydration
  });

  it('a known plan that moved (A → B) is a change: plan_changed, with the refresh that carries it', async () => {
    billingResponses.push(respondWith(200, PRO)); // replaces start()'s agreeing FREE below
    sessionResponses.push(respondWith(200, { ...SNAPSHOT, tenant: { ...SNAPSHOT.tenant, subscription: PRO } }));
    start(TOKEN_A);
    billingResponses.pop(); // start() queued FREE after our PRO — drop it
    const reasons: BridgeAuthorizationChangeReason[] = [];
    const off = onBridgeAuthorizationChange((r) => reasons.push(r));
    open();
    await settle();
    off();
    expect(tenantPlan()).toBe('pro');
    expect(reasons).toEqual(['subscription.plan_changed']);
    expect(refreshes).toBe(1);
  });

  it('reconciles once with a fresh mint and replaces no socket (TBP-644, TBP-700)', async () => {
    sessionResponses.push(respondWith(200, SNAPSHOT));
    start(TOKEN_A);
    open();
    await settle();
    expect(refreshes).toBe(1);
    expect(refreshOptions).toEqual([{ fresh: true }]);
    expect(reauthorizes).toBe(0);
  });

  it('emits no authorization change when the catch-up changed nothing', async () => {
    useBridge().entitlementsStore.applyEntitlementsChanged({ pro_page: false });
    applySessionSnapshot(SNAPSHOT as never);
    sessionResponses.push(respondWith(200, SNAPSHOT));
    start(TOKEN_A);
    const reasons: BridgeAuthorizationChangeReason[] = [];
    const off = onBridgeAuthorizationChange((r) => reasons.push(r));
    open();
    await settle();
    off();
    expect(calls.map((c) => c.path).sort()).toEqual(['/billing/state', '/session/init']);
    expect(reasons).toEqual([]);
  });

  it('a recovered change is reported as that change, never as a reconnect', async () => {
    applySessionSnapshot({ tenant: { entitlements: { pro_page: false } } } as never); // known before
    sessionResponses.push(respondWith(200, { ...SNAPSHOT, tenant: { ...SNAPSHOT.tenant, entitlements: { pro_page: true } } }));
    start(TOKEN_A);
    const reasons: BridgeAuthorizationChangeReason[] = [];
    const off = onBridgeAuthorizationChange((r) => reasons.push(r));
    open();
    await settle();
    off();
    expect(reasons).toEqual(['entitlements.changed']);
    // auth-core's copy — what flag targeting reads — moved with it.
    expect(useBridge().entitlementsStore.can('pro_page')).toBe(true);
  });

  it('re-reads only the quota metrics already hydrated, and applies the answers', async () => {
    useBridge().quotas.applyInitialSnapshot('ai_completions', quota('ai_completions', 10));
    quotaResponses.ai_completions = [respondWith(200, quota('ai_completions', 42))];
    start(TOKEN_A);
    open();
    await settle();

    expect(quotaCalls()).toEqual(['/usage/quota/ai_completions']);
    const call = calls.find((c) => c.path === '/usage/quota/ai_completions')!;
    expect(call.auth).toBe(`Bearer ${TOKEN_A}`);
    expect(call.appId).toBe('app-1');
    expect(useBridge().quotas.get('ai_completions')?.used).toBe(42); // no longer frozen
  });

  it('a live push that lands mid-fetch wins over the REST answer', async () => {
    useBridge().quotas.applyInitialSnapshot('ai_completions', quota('ai_completions', 10));
    const slow = gated(200, quota('ai_completions', 42));
    quotaResponses.ai_completions = [slow.answer];
    start(TOKEN_A);
    open();
    await flush();
    expect(quotaCalls()).toEqual(['/usage/quota/ai_completions']);

    // A `quota.updated` push lands while the GET is still out: it is newer.
    useBridge().quotas.applyQuotaUpdated(quota('ai_completions', 77) as never);
    slow.release();
    await settle();
    expect(useBridge().quotas.get('ai_completions')?.used).toBe(77);
  });

  it('makes no quota request when no metric was ever read', async () => {
    start(TOKEN_A);
    open();
    await settle();
    expect(quotaCalls()).toEqual([]);
    expect(calls.map((c) => c.path).sort()).toEqual(['/billing/state', '/session/init']);
  });

  it('a signed-out first connect makes no request at all', async () => {
    useBridge().quotas.applyInitialSnapshot('ai_completions', quota('ai_completions', 10));
    start(null);
    open();
    await settle();
    expect(calls).toEqual([]);
  });

  it('drops an answer that lands after the session changed', async () => {
    __resetSnapshotStores();
    const slow = gated(200, SNAPSHOT);
    sessionResponses.push(slow.answer);
    start(TOKEN_A);
    open();
    await flush();
    setToken(null); // sign-out while the snapshot read is in flight
    slow.release();
    await settle();
    expect(read(bridge.tenant.name)).toBeNull();
  });
});

// ── TBP-700 — a user-state change published during a (re)connect ─────────────
//
// Regression (stage, bridge-svelte, same wiring): a role change published while
// the socket was being replaced was lost for good. AppSync has no replay, the
// session snapshot's `user` is read from the token being presented, and the
// reconnect our own reauthorize() caused skipped the token refresh (the TBP-644
// loop guard). The user kept the old role until a reload.
//
// The server here is a tv counter; a refresh mints a token carrying the
// current one. `live` models the socket: a publish is delivered only while it
// is live, as on AppSync.
describe('a user-state change published during a (re)connect is never lost (TBP-700)', () => {
  let serverTv: number;
  let iat: number;
  const tokenAt = (tv: number) => {
    iat += 1;
    return jwt({ sub: 'user-1', tid: 'ws-1', aid: 'app-1', role: tv > 1 ? 'OWNER' : 'ADMIN', tv, iat });
  };
  const currentTv = () => {
    const at = useBridgeStore.getState().tokens?.accessToken;
    if (!at) return undefined;
    return JSON.parse(atob(at.split('.')[1])).tv as number;
  };

  beforeEach(() => {
    serverTv = 1;
    iat = 0;
    // A refresh mints the server's current state and stores it, like BridgeAuth.
    refreshResult = () => {
      const t = { accessToken: tokenAt(serverTv), refreshToken: 'r' };
      useBridgeStore.setState({ tokens: t } as never);
      return t;
    };
    // The reconcile's token is compared with the socket that was just
    // subscribed, so the connection has to read as open.
    spies.push(spyOn(RealtimeClient.prototype, 'getState').mockImplementation((() => 'open') as never));
  });

  it('a role change published while our own reauthorize() replaces the socket is recovered on the reconnect', async () => {
    start(tokenAt(1));
    // The plan never moves here, so nothing but the reconcile can recover the role.
    billingResponses.push(respondWith(200, FREE), respondWith(200, FREE), respondWith(200, FREE));
    open();
    await settle();
    const reauthsBefore = reauthorizes;
    setToken(tokenAt(1)); // a token rotation reauthorizes: the socket is being swapped…
    expect(reauthorizes).toBe(reauthsBefore + 1);
    serverTv = 2; // …and the role change is published into that gap: lost
    open(); // the replacement socket
    await settle();
    expect(currentTv()).toBe(2);
    // The recovered role gets its own socket, once — and the reconnect that
    // causes finds nothing new.
    expect(reauthorizes).toBe(reauthsBefore + 2);
    open();
    await settle();
    expect(reauthorizes).toBe(reauthsBefore + 2);
  });

  it('refresh → same authority → no reauthorize, so no reconnect to refresh again', async () => {
    start(tokenAt(1));
    for (let i = 0; i < 5; i++) {
      open();
      await settle();
    }
    // One reconcile per open the TRANSPORT produced, every one a fresh mint,
    // and not one reconnect of our own making.
    expect(refreshes).toBe(5);
    expect(refreshOptions.every((o) => o?.fresh === true)).toBe(true);
    expect(reauthorizes).toBe(0);
  });

  it('a new token with the same authority leaves the gates alone', async () => {
    start(tokenAt(1));
    const reasons: BridgeAuthorizationChangeReason[] = [];
    const off = onBridgeAuthorizationChange((r) => reasons.push(r));
    open();
    await settle();
    off();
    expect(refreshes).toBe(1);
    expect(reasons).toEqual([]);
  });

  it('a claim that differs on every mint cannot turn into a reconnect loop', async () => {
    let n = 0;
    refreshResult = () => {
      n += 1;
      const t = { accessToken: jwt({ sub: 'user-1', tid: 'ws-1', aid: 'app-1', tv: 1, nonce: n }), refreshToken: 'r' };
      useBridgeStore.setState({ tokens: t } as never);
      return t;
    };
    start(jwt({ sub: 'user-1', tid: 'ws-1', aid: 'app-1', tv: 1, nonce: 0 }));
    for (let i = 0; i < 10; i++) {
      open(); // every reauthorize "reconnects" at once
      await settle();
    }
    expect(reauthorizes).toBe(3); // MAX_RECONCILE_SWAPS, then it stops swapping
  });

  it('with setOnSubscribed, the catch-up waits for every channel, not the first ack', async () => {
    start(tokenAt(1));
    openHook?.(); // the first channel acked: 'open', the user channel still pending
    await settle();
    expect(refreshes).toBe(0);
    expect(calls).toEqual([]);
    subscribedHook?.(); // …and now every channel is live
    await settle();
    expect(refreshes).toBe(1);
    expect(calls.map((c) => c.path).sort()).toEqual(['/billing/state', '/session/init']);
  });
});

// TBP-762 — right after a checkout Bridge marks the sign-in out of date, and the
// catch-up's billing read answered 401 TOKEN_VERSION_STALE and applied nothing.
describe('the billing catch-up renews an out-of-date sign-in (TBP-762)', () => {
  it('a TOKEN_VERSION_STALE answer is retried once with a freshly minted token', async () => {
    const FRESH = jwt({ sub: 'user-1', tid: 'ws-1', aid: 'app-1', plan: 'pro', tv: 2 });
    refreshResult = () => ({ accessToken: FRESH, refreshToken: 'r' });
    start(TOKEN_A);
    billingResponses.length = 0; // replace start()'s agreeing FREE
    billingResponses.push(respondWith(401, { code: 'TOKEN_VERSION_STALE' }));
    billingResponses.push(respondWith(200, PRO));
    open();
    await settle();
    expect(billingFetches).toEqual([`Bearer ${TOKEN_A}`, `Bearer ${FRESH}`]);
    expect(billingPlan()).toBe('pro');
    expect(refreshOptions).toContainEqual({ fresh: true });
  });
});

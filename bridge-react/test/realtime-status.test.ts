/**
 * TBP-644 — the bridge runtime ↔ realtime client contract, driven through the
 * REAL auth-core RealtimeClient with a fake WebSocket + fetch.
 *
 * 1. The runtime reauthorized only on token ROTATION (A → B). A session that
 *    signed in after page load (none → A) kept the anonymous connection, and a
 *    client parked after a refusal stayed parked until something else
 *    reconnected it. It must reauthorize on every change of the token value.
 * 2. That must not reopen the self-induced refresh loop the on-open refresh
 *    guard exists for.
 * 3. `refreshAuthToken` is wired, and a refresh it triggers is not followed by
 *    a second one on the reconnect.
 * 4. The full RealtimeStatus reaches the public API; 'degraded' is wired.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { RealtimeStatus, WebSocketLike } from '@nebulr-group/bridge-auth-core';
import {
  __resetBridgeRuntime,
  getBridgeRealtime,
  onBridgeRealtimeStatus,
  startBridgeRuntime,
  stopBridgeRuntime,
} from '../src/core/bridge-runtime';
import { _resetBridgeInstance, getBridgeAuth, initBridge, useBridgeStore } from '../src/core/bridge-instance';
import {
  _setRealtimeStatusDetail,
  realtimeStatus,
  realtimeStatusDetail,
} from '../src/core/realtime-status';

// ── Fakes ───────────────────────────────────────────────────────────────────

class FakeWebSocket implements WebSocketLike {
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: ((ev: unknown) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  constructor(public url: string, public protocols?: string | string[]) {
    FakeWebSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close(code?: number) {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.onclose?.({ code });
  }
  message(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

const API = 'http://api.test.local';
const APPSYNC_HOST = 'svc.appsync-realtime-api.eu-west-1.amazonaws.com';

const fetchFn = (async (url: string) => {
  const path = new URL(url).pathname;
  const body = path === '/realtime/config' ? { kind: 'appsync', endpoint: APPSYNC_HOST } : {};
  return { ok: path === '/realtime/config', status: path === '/realtime/config' ? 200 : 404, json: async () => body };
}) as unknown as typeof fetch;

function b64url(s: string): string {
  return Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
let tokenSeq = 0;
function token(sub = 'user-1'): string {
  tokenSeq += 1;
  const claims = { iss: `${API}/auth`, aid: 'app-1', tid: 't-1', sub, iat: tokenSeq, exp: Math.floor(Date.now() / 1000) + 3600 };
  return `${b64url(JSON.stringify({ alg: 'PS256' }))}.${b64url(JSON.stringify(claims))}.sig`;
}

function setTokens(accessToken: string | null): void {
  useBridgeStore.setState({ tokens: accessToken ? { accessToken, refreshToken: 'r' } : null } as never);
}

/** Authorization the socket presented in its AppSync `header-…` subprotocol. */
function presented(ws: FakeWebSocket): string {
  const list = Array.isArray(ws.protocols) ? ws.protocols : [ws.protocols ?? ''];
  const header = list.find((p) => p.startsWith('header-'))!.slice('header-'.length);
  const padded = header.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((header.length + 3) % 4);
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8')).Authorization;
}

function connectOk(ws: FakeWebSocket): void {
  ws.readyState = 1;
  ws.onopen?.({});
  ws.message({ type: 'connection_ack' });
  for (const raw of ws.sent) {
    const f = JSON.parse(raw);
    if (f.type === 'subscribe') ws.message({ type: 'subscribe_success', id: f.id });
  }
}

function refuse(ws: FakeWebSocket): void {
  ws.readyState = 1;
  ws.onopen?.({});
  ws.message({ type: 'connection_error', errors: [{ errorType: 'UnauthorizedException', errorCode: 401 }] });
}

const settle = async (ms = 20) => {
  for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, ms / 3));
};
const lastWs = () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1];

let reauthCalls = 0;
let refreshCalls = 0;
/** What the patched BridgeAuth.refreshTokens does (after counting). */
let refreshImpl: () => Promise<{ accessToken: string } | null> = async () => null;

async function start(): Promise<void> {
  startBridgeRuntime({
    realtime: { websocketFactory: (u, p) => new FakeWebSocket(u, p), fetchFn, reportStatus: false, diagnose: false, reconnectBaseMs: 5 },
  });
  const rt = getBridgeRealtime()!;
  const original = rt.reauthorize.bind(rt);
  rt.reauthorize = async () => {
    reauthCalls += 1;
    return original();
  };
  await settle();
}

beforeEach(() => {
  __resetBridgeRuntime();
  _resetBridgeInstance();
  FakeWebSocket.instances = [];
  reauthCalls = 0;
  refreshCalls = 0;
  refreshImpl = async () => null;
  _setRealtimeStatusDetail({ state: 'idle', retrying: false, since: 0 });
  initBridge({ appId: 'app-1', apiBaseUrl: API } as never);
  setTokens(null);
  const auth = getBridgeAuth();
  (auth as unknown as { refreshTokens: () => Promise<unknown> }).refreshTokens = async () => {
    refreshCalls += 1;
    return refreshImpl();
  };
});

afterEach(async () => {
  await stopBridgeRuntime();
  __resetBridgeRuntime();
});

// ── 1. reauthorize on every token value change ─────────────────────────────

describe('reauthorizes on every token value change (TBP-644)', () => {
  it('first sign-in (no token → token) reconnects with the user token', async () => {
    await start();
    connectOk(lastWs());
    expect(presented(lastWs())).toBe('anonymous');

    const t = token();
    setTokens(t);
    expect(reauthCalls).toBe(1);
    await settle();
    expect(presented(lastWs())).toBe(`Bearer ${t}`);
  });

  it('a signed-out session parked after a refusal resumes as soon as the user signs in', async () => {
    await start();
    refuse(lastWs()); // anonymous connect refused → parked
    await settle();
    expect(getBridgeRealtime()!.getState()).toBe('unauthorized');
    const before = FakeWebSocket.instances.length;

    const t = token();
    setTokens(t);
    await settle();
    // Resumes NOW — not after auth-core's 5 s parked-token poll.
    expect(FakeWebSocket.instances.length).toBe(before + 1);
    expect(presented(lastWs())).toBe(`Bearer ${t}`);
  });

  it('sign-out (token → no token) reconnects as the signed-out session', async () => {
    setTokens(token());
    await start();
    connectOk(lastWs());
    setTokens(null);
    expect(reauthCalls).toBe(1);
    await settle();
    expect(presented(lastWs())).toBe('anonymous');
  });

  it('the token already present at start is not a change — start() connects with it', async () => {
    const t = token();
    setTokens(t);
    await start();
    expect(reauthCalls).toBe(0);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(presented(lastWs())).toBe(`Bearer ${t}`);
  });
});

// ── 2. the self-induced refresh loop guard still holds ─────────────────────

describe('the self-induced refresh loop guard still holds (TBP-644)', () => {
  it('the reconnect caused by a sign-in does not fire the on-open refresh; a genuine one does', async () => {
    await start();
    connectOk(lastWs()); // initial, anonymous open
    setTokens(token());
    await settle();
    connectOk(lastWs()); // the reconnect the sign-in reauthorize caused
    await settle();
    expect(refreshCalls).toBe(0);

    lastWs().close(1006); // a genuine drop
    await settle(40);
    connectOk(lastWs());
    await settle();
    expect(refreshCalls).toBe(1);
  });
});

// ── 3. refreshAuthToken ────────────────────────────────────────────────────

describe('refreshAuthToken is wired (TBP-644)', () => {
  it('a refused session refreshes once, reconnects with the NEW token, and does not refresh again on open', async () => {
    setTokens(token());
    await start();
    connectOk(lastWs()); // open #1
    lastWs().close(1006); // drop → reconnect …
    await settle(40);

    const fresh = token();
    refreshImpl = async () => {
      setTokens(fresh);
      return { accessToken: fresh };
    };
    refuse(lastWs()); // … which Bridge refuses
    await settle();
    expect(refreshCalls).toBe(1);
    expect(presented(lastWs())).toBe(`Bearer ${fresh}`);

    connectOk(lastWs()); // open #2 on the refreshed token
    await settle();
    expect(getBridgeRealtime()!.getState()).toBe('open');
    // Without the self-induced flag this open would refresh AGAIN.
    expect(refreshCalls).toBe(1);
  });

  it('a signed-out session has nothing to refresh', async () => {
    await start();
    refuse(lastWs());
    await settle();
    expect(refreshCalls).toBe(0);
  });
});

// ── 4. status reaches the public API ───────────────────────────────────────

describe('the full realtime status reaches the public API (TBP-644)', () => {
  it("propagates 'unauthorized' with reason, side, docs link and ref", async () => {
    const seen: RealtimeStatus[] = [];
    onBridgeRealtimeStatus((s) => seen.push(s));
    let detail: RealtimeStatus | undefined;
    let state: string | undefined;
    const offDetail = realtimeStatusDetail.subscribe((d) => (detail = d));
    const offState = realtimeStatus.subscribe((s) => (state = s));

    setTokens(token());
    await start();
    refuse(lastWs()); // refresh resolves null → diagnosis → parked
    await settle();

    expect(state).toBe('unauthorized');
    expect(detail?.state).toBe('unauthorized');
    expect(detail?.reason).toBeString();
    expect(detail?.side).toBeString();
    expect(detail?.retrying).toBe(false);
    expect(detail?.docsUrl).toContain(`#${detail?.reason}`);
    expect(detail?.ref).toBeString();
    expect(seen[seen.length - 1]).toEqual(detail!);
    offDetail();
    offState();
  });

  it("reports 'degraded' when every channel subscription is rejected", async () => {
    await start();
    const ws = lastWs();
    ws.readyState = 1;
    ws.onopen?.({});
    ws.message({ type: 'connection_ack' });
    for (const raw of ws.sent) {
      const f = JSON.parse(raw);
      if (f.type === 'subscribe') ws.message({ type: 'subscribe_error', id: f.id, errors: [{ errorType: 'X' }] });
    }
    let state: string | undefined;
    const off = realtimeStatus.subscribe((s) => (state = s));
    expect(state).toBe('degraded');
    off();
  });
});

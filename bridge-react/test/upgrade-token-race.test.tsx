/**
 * Regression (TBP-654, upgrade race), ported from bridge-svelte PR #62.
 * Found by the M33 clean-room smoke on stage, 2 of 6 runs:
 *
 *   +484 ms  subscription.plan_changed → the page shows "Pro"
 *   +489 ms  the user clicks into the plan-gated page
 *            → the decision is taken with the OLD (Free) access token → refused
 *   +774 ms  the token refresh (started by user.state_changed) lands
 *
 * bridge-react has no route rules: gates are `useFlag` components, and an app's
 * own one-shot check can wait on `settleBridgeAuthorizationChange()`. The
 * runtime must start the refresh on the plan change itself, register it as the
 * pending authorization change, and follow up once when the joined refresh
 * predates the announced token version.
 *
 * Real runtime, real guard cache, real flag registry and `useFlag`. Faked: the
 * token refresh (lands after a delay with the token the server would mint), the
 * billing-bridge handler registration and the realtime user-state hook, so the
 * test can deliver the pushes. The gate reads the plan from the CURRENT token,
 * as a server-evaluated flag does.
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { act, cleanup, render } from '@testing-library/react';
import {
  RealtimeClient,
  useBridge,
  type UserStateMessage,
  type WebSocketLike,
} from '@nebulr-group/bridge-auth-core';
import { __resetBridgeRuntime, startBridgeRuntime, stopBridgeRuntime } from '../src/core/bridge-runtime';
import { _resetBridgeInstance, getBridgeAuth, initBridge, useBridgeStore } from '../src/core/bridge-instance';
import { AUTHORIZATION_CHANGE_WAIT_MS } from '../src/core/guard-cache';
import { __resetSnapshotStores } from '../src/core/snapshot-stores';
import { setBridgeFlagsInstance } from '../src/flags/registry';
import { useFlag } from '../src/flags/use-flag';
import { settleBridgeAuthorizationChange } from '../src';

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
const fetchFn = (async (url: string) => {
  const ok = new URL(url).pathname === '/realtime/config';
  const body = ok ? { kind: 'appsync', endpoint: 'svc.appsync-realtime-api.eu-west-1.amazonaws.com' } : {};
  return { ok, status: ok ? 200 : 404, json: async () => body };
}) as unknown as typeof fetch;

function jwt(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  return `${b64({ alg: 'none' })}.${b64(claims)}.sig`;
}
const base = { sub: 'user-1', tid: 'ws-1', aid: 'app-1' };
const FREE = jwt({ ...base, plan: 'free', tv: 1 });
// Minted after the plan was saved but BEFORE the server bumped tokenVersion.
const PRO_PRE_BUMP = jwt({ ...base, plan: 'pro', tv: 1 });
const PRO = jwt({ ...base, plan: 'pro', tv: 2 });

const current = () => useBridgeStore.getState().tokens?.accessToken ?? null;
const planOf = (token: string | null) => (token ? JSON.parse(atob(token.split('.')[1])).plan : null);
function setToken(accessToken: string | null): void {
  useBridgeStore.setState({ tokens: accessToken ? { accessToken, refreshToken: 'r' } : null } as never);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PLAN_CHANGED = {
  kind: 'subscription.plan_changed',
  tenantId: 'ws-1',
  from: { slug: 'free' },
  to: { slug: 'pro', name: 'Pro' },
  status: 'active',
  effectiveAt: '2026-09-15T10:00:00.000Z',
};
const ENTITLEMENTS_CHANGED = {
  kind: 'entitlements.changed',
  tenantId: 'ws-1',
  effectiveAt: '2026-09-15T10:00:00.000Z',
  entitlements: { pro_page: true },
};

// ── Fixture ─────────────────────────────────────────────────────────────────

let billing: Record<string, (msg: unknown) => void>;
let userState: (msg: UserStateMessage & { tokenVersion?: number }) => Promise<void> | void;
let refreshCalls = 0;
/** What the next refreshes do, in call order; the last entry repeats. */
let refreshPlan: Array<() => Promise<unknown>> = [];
const spies: Array<{ mockRestore(): void }> = [];

/** The server mints `token`; it lands `ms` after the refresh starts. */
function landsAfter(ms: number, token: string = PRO): () => Promise<unknown> {
  return () =>
    sleep(ms).then(() => {
      setToken(token);
      return { accessToken: token };
    });
}

function start(seed: string | null = FREE): void {
  setToken(seed);
  startBridgeRuntime({
    realtime: { websocketFactory: () => new InertWebSocket(), fetchFn, reportStatus: false, diagnose: false },
  });
}

beforeEach(() => {
  __resetBridgeRuntime();
  _resetBridgeInstance();
  __resetSnapshotStores();
  initBridge({ appId: 'app-1', apiBaseUrl: API } as never);
  refreshCalls = 0;
  refreshPlan = [landsAfter(60)];

  const auth = getBridgeAuth();
  spies.push(
    spyOn(auth, 'invalidateFeatureFlagCache').mockImplementation(() => {}),
    spyOn(auth, 'refreshTokens').mockImplementation((() => {
      refreshCalls += 1;
      const next = refreshPlan.length > 1 ? refreshPlan.shift()! : refreshPlan[0];
      return next();
    }) as never),
  );
  const billingBridge = useBridge();
  spies.push(
    spyOn(billingBridge, 'handle').mockImplementation(((h: Record<string, (msg: unknown) => void>) => {
      billing = h;
      return () => {};
    }) as never),
    spyOn(billingBridge, 'attachToRealtimeClient').mockImplementation((() => {}) as never),
    spyOn(RealtimeClient.prototype, 'setOnUserState').mockImplementation(function (
      this: RealtimeClient,
      h: typeof userState,
    ) {
      userState = h;
    } as never),
  );
  // `pro-page` = `tenant.plan in [pro]`, evaluated with the token the SDK holds.
  setBridgeFlagsInstance({
    flag: (key: string, fallback: unknown) =>
      key === 'pro-page' ? { passed: planOf(current()) === 'pro', value: planOf(current()) === 'pro' } : { passed: false, value: fallback },
  } as never);
});

afterEach(async () => {
  cleanup();
  for (const spy of spies.splice(0)) spy.mockRestore();
  setBridgeFlagsInstance(undefined);
  await stopBridgeRuntime();
  __resetBridgeRuntime();
  _resetBridgeInstance();
  setToken(null);
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('a plan change starts the token refresh at once (TBP-654)', () => {
  it('subscription.plan_changed starts the refresh itself — it does not wait for user.state_changed', () => {
    start();
    billing['subscription.plan_changed'](PLAN_CHANGED);
    expect(refreshCalls).toBe(1);
  });

  it('entitlements.changed starts it too', () => {
    start();
    billing['entitlements.changed'](ENTITLEMENTS_CHANGED);
    expect(refreshCalls).toBe(1);
  });

  it('a check that settles right after plan_changed decides with the new token', async () => {
    start();
    billing['subscription.plan_changed'](PLAN_CHANGED); // the page now says Pro
    expect(planOf(current())).toBe('free'); // …but the token does not, yet
    await settleBridgeAuthorizationChange(); // the user clicks; the app's check waits
    expect(current()).toBe(PRO);
  });

  it('a useFlag gate re-evaluates once the refreshed token lands', async () => {
    start();
    function Gate() {
      return <span data-testid="gate">{useFlag('pro-page', false).value ? 'open' : 'locked'}</span>;
    }
    const { getByTestId } = render(<Gate />);
    expect(getByTestId('gate').textContent).toBe('locked');

    act(() => billing['subscription.plan_changed'](PLAN_CHANGED));
    await act(() => settleBridgeAuthorizationChange());

    expect(getByTestId('gate').textContent).toBe('open');
  });

  it('a refresh slower than the bound → decided at the bound with the token it has: fail closed', async () => {
    start();
    refreshPlan = [landsAfter(1_000)];
    billing['subscription.plan_changed'](PLAN_CHANGED);
    const t0 = Date.now();
    await settleBridgeAuthorizationChange(80);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(70);
    expect(Date.now() - t0).toBeLessThan(900);
    expect(current()).toBe(FREE);
  });

  it('the default bound is 3 s', () => {
    expect(AUTHORIZATION_CHANGE_WAIT_MS).toBe(3_000);
  });

  it('a refresh that fails does not hang the wait or change the token', async () => {
    start();
    refreshPlan = [() => Promise.reject(new Error('refresh 500'))];
    billing['subscription.plan_changed'](PLAN_CHANGED);
    await expect(settleBridgeAuthorizationChange()).resolves.toBeUndefined();
    expect(current()).toBe(FREE);
  });

  it('plan_changed + entitlements.changed + user.state_changed in quick succession → ONE refresh', async () => {
    start();
    billing['subscription.plan_changed'](PLAN_CHANGED);
    await sleep(10);
    billing['entitlements.changed'](ENTITLEMENTS_CHANGED);
    await sleep(10);
    // The joined refresh already carries the version this message announces.
    await userState({ kind: 'user.state_changed', reason: 'plan_changed', tokenVersion: 2 } as never);
    expect(current()).toBe(PRO);
    // The new token re-runs the authorization change once, without refreshing again.
    expect(refreshCalls).toBe(1);
  });

  it('nothing pending → the wait resolves at once, and nothing refreshes', async () => {
    start();
    const winner = await Promise.race([settleBridgeAuthorizationChange().then(() => 'settled'), sleep(0).then(() => 'timer')]);
    expect(winner).toBe('settled');
    expect(refreshCalls).toBe(0);
  });
});

// The early refresh is minted after the plan is saved but can land BEFORE the
// server bumps tokenVersion (it bumps after publishing plan_changed). That
// token has the new plan but is TOKEN_VERSION_STALE for every version-checked
// endpoint — seen on stage as /billing/state 401 → "Subscription unavailable".
describe('a joined refresh that predates the announced token version is followed up once (TBP-654)', () => {
  it('user.state_changed announces tv 2 while the joined refresh mints tv 1 → one follow-up refresh to tv 2', async () => {
    start();
    refreshPlan = [landsAfter(40, PRO_PRE_BUMP), landsAfter(40, PRO)];
    billing['subscription.plan_changed'](PLAN_CHANGED);
    const done = userState({ kind: 'user.state_changed', reason: 'plan_changed', tokenVersion: 2 } as never);
    expect(refreshCalls).toBe(1); // joined, not duplicated
    await done;
    expect(current()).toBe(PRO);
    expect(refreshCalls).toBe(2);
  });

  it('a check during the follow-up waits for it too', async () => {
    start();
    refreshPlan = [landsAfter(40, PRO_PRE_BUMP), landsAfter(40, PRO)];
    billing['subscription.plan_changed'](PLAN_CHANGED);
    void userState({ kind: 'user.state_changed', reason: 'plan_changed', tokenVersion: 2 } as never);
    await settleBridgeAuthorizationChange();
    expect(current()).toBe(PRO);
  });

  it('no version on the message (older server) → the single refresh stands', async () => {
    start();
    refreshPlan = [landsAfter(40, PRO_PRE_BUMP)];
    billing['subscription.plan_changed'](PLAN_CHANGED);
    await userState({ kind: 'user.state_changed', reason: 'plan_changed' } as never);
    expect(refreshCalls).toBe(1);
    expect(current()).toBe(PRO_PRE_BUMP);
  });
});

describe('signed-out sessions are unaffected (TBP-654)', () => {
  it('no token → the events start no refresh and nothing waits', async () => {
    start(null);
    billing['subscription.plan_changed'](PLAN_CHANGED);
    billing['entitlements.changed'](ENTITLEMENTS_CHANGED);
    await userState({ kind: 'user.state_changed', reason: 'plan_changed', tokenVersion: 5 } as never);
    expect(refreshCalls).toBe(0);
    const winner = await Promise.race([settleBridgeAuthorizationChange().then(() => 'settled'), sleep(0).then(() => 'timer')]);
    expect(winner).toBe('settled');
  });
});

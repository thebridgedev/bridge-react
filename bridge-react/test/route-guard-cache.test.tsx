/**
 * TBP-654 — a plan / entitlement / user-state / token change re-evaluates every
 * flag gate, once per event, before the event reaches app handlers.
 *
 * Regression: only a flag push re-evaluated `useFlag` gates. A route guarded by
 * a plan-targeted flag (`<FlagRoute flag="pro-page">`, the pattern our guides
 * teach) kept redirecting a user who had just upgraded, and auth-core's
 * FeatureFlagService kept its 5-minute verdicts. Reproduced on stage against
 * bridge-svelte 0.8.0-beta.1, which shares this wiring; ported from
 * bridge-svelte PR #56.
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { act, cleanup, render } from '@testing-library/react';
import {
  RealtimeClient,
  useBridge,
  type UserStateMessage,
  type WebSocketLike,
} from '@nebulr-group/bridge-auth-core';
import { bridgeEvents, type BridgeEventHandlers } from '../src/core/events';
import {
  __resetBridgeRuntime,
  onBridgeAuthorizationChange,
  onBridgeRealtimeUserState,
  startBridgeRuntime,
  stopBridgeRuntime,
  type BridgeAuthorizationChangeReason,
} from '../src/core/bridge-runtime';
import { _resetBridgeInstance, getBridgeAuth, initBridge, useBridgeStore } from '../src/core/bridge-instance';
import { __resetSnapshotStores } from '../src/core/snapshot-stores';
import { setBridgeFlagsInstance, subscribeToFlagChanges } from '../src/flags/registry';
import { useFlag } from '../src/flags/use-flag';

// ── Harness ─────────────────────────────────────────────────────────────────

/** A socket that never opens — the tests drive the runtime's handlers directly. */
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
const TOKEN_A = jwt({ sub: 'user-1', tid: 'ws-1', aid: 'app-1', plan: 'free' });
const TOKEN_B = jwt({ sub: 'user-1', tid: 'ws-1', aid: 'app-1', plan: 'pro' });

function setToken(accessToken: string | null): void {
  useBridgeStore.setState({ tokens: accessToken ? { accessToken, refreshToken: 'r' } : null } as never);
}

const planChanged = {
  kind: 'subscription.plan_changed',
  tenantId: 'ws-1',
  from: { slug: 'free' },
  to: { slug: 'pro', name: 'Pro' },
  status: 'active',
  effectiveAt: '2026-09-15T08:00:00.000Z',
};
const entitlementsChanged = {
  kind: 'entitlements.changed',
  tenantId: 'ws-1',
  effectiveAt: '2026-09-15T08:00:00.000Z',
  entitlements: { app_active: true, advanced_analytics: true },
};

// ── Fixture ─────────────────────────────────────────────────────────────────

let billing: Record<string, (msg: unknown) => void>;
let userState: (msg: UserStateMessage) => Promise<void> | void;
let invalidations = 0;
let flagBusAll = 0;
const spies: Array<{ mockRestore(): void }> = [];
const offs: Array<() => void> = [];
const on = (handlers: BridgeEventHandlers) => offs.push(bridgeEvents.handle(handlers));

function start(seedToken: string | null = null): void {
  setToken(seedToken);
  startBridgeRuntime({
    realtime: { websocketFactory: () => new InertWebSocket(), fetchFn, reportStatus: false, diagnose: false },
  });
}

beforeEach(() => {
  __resetBridgeRuntime();
  _resetBridgeInstance();
  __resetSnapshotStores();
  initBridge({ appId: 'app-1', apiBaseUrl: API } as never);
  invalidations = 0;
  flagBusAll = 0;

  const auth = getBridgeAuth();
  spies.push(
    spyOn(auth, 'invalidateFeatureFlagCache').mockImplementation(() => {
      invalidations += 1;
    }),
    // user.state_changed triggers a refresh; there is no API here.
    spyOn(auth, 'refreshTokens').mockImplementation((async () => null) as never),
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
      h: (msg: UserStateMessage) => Promise<void> | void,
    ) {
      userState = h;
    } as never),
  );
  offs.push(
    subscribeToFlagChanges((key) => {
      if (key === '*') flagBusAll += 1;
    }),
  );
});

afterEach(async () => {
  cleanup();
  for (const off of offs.splice(0)) off();
  for (const spy of spies.splice(0)) spy.mockRestore();
  setBridgeFlagsInstance(undefined);
  await stopBridgeRuntime();
  __resetBridgeRuntime();
  _resetBridgeInstance();
});

// ── Each trigger: once, before dispatch ─────────────────────────────────────

describe('gate caches are dropped once per authorization change, before dispatch (TBP-654)', () => {
  it('subscription.plan_changed', () => {
    start(TOKEN_A);
    const atDispatch: number[] = [];
    on({ 'subscription.plan_changed': () => atDispatch.push(invalidations) });

    billing['subscription.plan_changed'](planChanged);

    expect(atDispatch).toEqual([1]);
    expect(invalidations).toBe(1);
    expect(flagBusAll).toBe(1);
  });

  it('entitlements.changed', () => {
    start(TOKEN_A);
    const atDispatch: number[] = [];
    on({ 'entitlements.changed': () => atDispatch.push(invalidations) });

    billing['entitlements.changed'](entitlementsChanged);

    expect(atDispatch).toEqual([1]);
    expect(invalidations).toBe(1);
    expect(flagBusAll).toBe(1);
  });

  it('user.state_changed', async () => {
    start(TOKEN_A);
    const atDispatch: number[] = [];
    offs.push(onBridgeRealtimeUserState(() => atDispatch.push(invalidations)));

    await userState({ kind: 'user.state_changed', reason: 'plan_changed' } as UserStateMessage);

    expect(atDispatch).toEqual([1]);
    expect(invalidations).toBe(1);
    expect(flagBusAll).toBe(1);
  });

  it('every access-token change — sign-in, rotation, sign-out — but not the seed or a no-op', () => {
    start(null);
    expect(invalidations).toBe(0); // the token present at start is not a change

    setToken(TOKEN_A); // sign-in
    expect(invalidations).toBe(1);
    setToken(TOKEN_A); // same value
    expect(invalidations).toBe(1);
    setToken(TOKEN_B); // refresh after the plan change
    expect(invalidations).toBe(2);
    setToken(null); // sign-out
    expect(invalidations).toBe(3);
    expect(flagBusAll).toBe(3);
  });

  it('lifecycle events that cannot move a verdict are left alone', () => {
    start(TOKEN_A);
    billing['payment.succeeded']({ kind: 'payment.succeeded', tenantId: 'ws-1' });
    billing['quota.updated']({ kind: 'quota.updated', tenantId: 'ws-1', metric: 'm' });
    expect(invalidations).toBe(0);
    expect(flagBusAll).toBe(0);
  });

  it('onBridgeAuthorizationChange subscribers see each reason, with the cache already dropped', async () => {
    start(TOKEN_A);
    const seen: Array<[BridgeAuthorizationChangeReason, number]> = [];
    const off = onBridgeAuthorizationChange((reason) => seen.push([reason, invalidations]));

    billing['subscription.plan_changed'](planChanged);
    billing['entitlements.changed'](entitlementsChanged);
    await userState({ kind: 'user.state_changed', reason: 'plan_changed' } as UserStateMessage);
    setToken(TOKEN_B);
    off();
    setToken(null);

    expect(seen).toEqual([
      ['subscription.plan_changed', 1],
      ['entitlements.changed', 2],
      ['user.state_changed', 3],
      ['token', 4],
    ]);
  });

  it('a throwing subscriber does not stop the event reaching app handlers', () => {
    start(TOKEN_A);
    offs.push(
      onBridgeAuthorizationChange(() => {
        throw new Error('boom');
      }),
    );
    const received: unknown[] = [];
    on({ 'subscription.plan_changed': (m) => received.push(m) });

    expect(() => billing['subscription.plan_changed'](planChanged)).not.toThrow();
    expect(received).toEqual([planChanged]);
  });
});

// ── The behaviour: a plan-gated route guard unlocks without a reload ───────

describe('a useFlag route guard follows a live plan change (TBP-654)', () => {
  // Models the BillingAttributeProvider: evaluation reads live billing state,
  // but nothing about the read tells React the state moved.
  let plan = 'free';
  let entitled = false;

  function installFlags(): void {
    setBridgeFlagsInstance({
      flag: (key: string, fallback: unknown) => {
        if (key === 'pro-page') return { passed: plan === 'pro', value: plan === 'pro' };
        if (key === 'analytics-page') return { passed: entitled, value: entitled };
        return { passed: false, value: fallback };
      },
    } as never);
  }

  function Gate({ flag }: { flag: string }) {
    const { value } = useFlag(flag, false);
    return <span data-testid={flag}>{value ? 'open' : 'locked'}</span>;
  }

  beforeEach(() => {
    plan = 'free';
    entitled = false;
    installFlags();
  });

  it('Free → Pro: the plan-gated guard opens on subscription.plan_changed', () => {
    start(TOKEN_A);
    const { getByTestId } = render(<Gate flag="pro-page" />);
    expect(getByTestId('pro-page').textContent).toBe('locked');

    act(() => {
      plan = 'pro'; // auth-core moved its subscription store before our handler ran
      billing['subscription.plan_changed'](planChanged);
    });

    expect(getByTestId('pro-page').textContent).toBe('open');
  });

  it('an entitlement-gated guard opens on entitlements.changed', () => {
    start(TOKEN_A);
    const { getByTestId } = render(<Gate flag="analytics-page" />);
    expect(getByTestId('analytics-page').textContent).toBe('locked');

    act(() => {
      entitled = true;
      billing['entitlements.changed'](entitlementsChanged);
    });

    expect(getByTestId('analytics-page').textContent).toBe('open');
  });

  it('a downgrade locks the guard again on user.state_changed', async () => {
    plan = 'pro';
    start(TOKEN_B);
    const { getByTestId } = render(<Gate flag="pro-page" />);
    expect(getByTestId('pro-page').textContent).toBe('open');

    await act(async () => {
      plan = 'free';
      await userState({ kind: 'user.state_changed', reason: 'plan_changed' } as UserStateMessage);
    });

    expect(getByTestId('pro-page').textContent).toBe('locked');
  });
});

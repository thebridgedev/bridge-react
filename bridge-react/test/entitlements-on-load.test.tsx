/**
 * TBP-941 — a page that loads signed in shows the features the workspace's
 * plan includes, unlocked from the first paint.
 *
 * Seen in the 9 Nov test runs (bridge-react 0.8.1): after paying for Pro,
 * Colors and Logo unlocked (a live push arrived), but 7 of 8 later reloads,
 * and a fresh sign-in, showed "Upgrade to use this" again while
 * `session/init` said both entitlements were true. `GET /entitlements` was
 * never requested: nothing configured or loaded auth-core's entitlements
 * store, which flag rules on `bridge:billing.entitlement.*` read, and it is
 * fail-closed. bridge-svelte loads it before the first render (TBP-810).
 *
 * Revert-proof: on origin/main the reload case renders "Upgrade to use this"
 * and never requests `/entitlements`.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { useBridge as useBillingBridge } from '@nebulr-group/bridge-auth-core';
import { FeatureFlag } from '../src/flags/FeatureFlag';
import { setBridgeFlagsInstance } from '../src/flags/registry';
import { BridgeProvider } from '../src/providers/bridge-provider';
import { _resetBridgeInstance, getBridgeAuth, useBridgeStore } from '../src/core/bridge-instance';
import { __resetBridgeRuntime } from '../src/core/bridge-runtime';
import { __resetSnapshotStores } from '../src/core/snapshot-stores';
import { __resetStartupReadsForTests } from '../src/core/startup-reads';

const API = 'http://api.test.local';
const APP = 'tbp-941';

function jwt(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  return `${b64({ alg: 'none' })}.${b64(claims)}.sig`;
}
const exp = () => Math.floor(Date.now() / 1000) + 3600;
const tokensFor = (tid: string) => ({
  accessToken: jwt({ sub: 'user-1', tid, aid: APP, exp: exp() }),
  refreshToken: 'r',
  idToken: 'i',
});

/** The flag the QR Studio app gated Colors on, as the test run created it. */
const FLAGS = [
  {
    key: 'custom-colors',
    state: 'on-with-rule',
    valueType: 'boolean',
    onValue: true,
    offValue: false,
    rule: {
      branches: [
        {
          conditions: [{ attribute: 'bridge:billing.entitlement.custom_colors', operator: 'eq', values: [true] }],
          returnValue: true,
        },
      ],
      otherwiseValue: false,
      rolloutPct: 100,
    },
  },
];

/** What `GET /entitlements` answers, per workspace. */
let entitlements: Record<string, Record<string, boolean>> = {};
let requests: string[] = [];
let originalFetch: typeof fetch;
const originalVersions = process.versions;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
function workspaceOf(auth: string | null): string {
  const part = auth?.replace('Bearer ', '').split('.')[1] ?? '';
  try {
    return (JSON.parse(atob(part)) as { tid: string }).tid;
  } catch {
    return '';
  }
}

beforeEach(() => {
  // Keep auth-core's durable usage queue in memory, not in ~/.bridge.
  Object.defineProperty(process, 'versions', { configurable: true, value: { ...originalVersions, node: undefined } });
  entitlements = { 'ws-pro': { custom_colors: true }, 'ws-free': { custom_colors: false }, 'ws-pro-2': { custom_colors: true } };
  requests = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    const path = url.startsWith(API) ? url.slice(API.length).split('?')[0] : url;
    requests.push(path);
    if (path === '/entitlements') {
      const ws = workspaceOf(new Headers(init?.headers).get('Authorization'));
      return json(200, { entitlements: entitlements[ws] ?? {} });
    }
    if (path === `/admin/flags-internal/flags-cache/${APP}`) return json(200, FLAGS);
    if (path === '/auth/token') {
      // The page's background refresh: a new token for the same session.
      const current = (getBridgeAuth().getApiContext().accessToken ?? '').split('.')[1] ?? '';
      const claims = JSON.parse(atob(current)) as Record<string, unknown>;
      return json(201, { access_token: jwt({ ...claims, iat: Date.now() }), refresh_token: 'r2', id_token: 'i' });
    }
    return json(404, {});
  }) as typeof fetch;
  __resetBridgeRuntime();
  _resetBridgeInstance();
  __resetSnapshotStores();
  __resetStartupReadsForTests();
  useBillingBridge().entitlementsStore.__resetForTests();
});

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  localStorage.removeItem(`bridge_tokens:${APP}`);
  Object.defineProperty(process, 'versions', { configurable: true, value: originalVersions });
  setBridgeFlagsInstance(undefined);
  __resetBridgeRuntime();
  _resetBridgeInstance();
  __resetSnapshotStores();
  __resetStartupReadsForTests();
  useBillingBridge().entitlementsStore.__resetForTests();
});

/** What auth-core does on a sign-in or workspace switch: store the tokens, then announce them. */
function signIn(tokens: ReturnType<typeof tokensFor>): void {
  (getBridgeAuth() as unknown as { tokenManager: { tokens: unknown } }).tokenManager.tokens = tokens;
  useBridgeStore.setState({ tokens });
}

/** Render the app and record whether "Upgrade to use this" is EVER on screen. */
function renderStudio() {
  const view = render(
    <StrictMode>
      <BridgeProvider appId={APP} config={{ apiBaseUrl: API, billing: { paywallRoute: false } }}>
        <FeatureFlag flagKey="custom-colors" defaultValue={false} upgrade>
          <span data-testid="colors">Colors</span>
        </FeatureFlag>
      </BridgeProvider>
    </StrictMode>,
  );
  let lockedSeen = !!view.container.querySelector('[data-bridge-feature-upgrade]');
  const observer = new MutationObserver(() => {
    if (view.container.querySelector('[data-bridge-feature-upgrade]')) lockedSeen = true;
  });
  observer.observe(view.container, { childList: true, subtree: true });
  return {
    ...view,
    unlocked: () => !!view.container.querySelector('[data-testid="colors"]'),
    locked: () => !!view.container.querySelector('[data-bridge-feature-upgrade]'),
    lockedSeen: () => lockedSeen,
    stop: () => observer.disconnect(),
  };
}

describe('TBP-941 — plan-gated features on a reload and after a sign-in', () => {
  it('a reload of a workspace whose plan includes the feature renders it unlocked, with no locked flash', async () => {
    localStorage.setItem(`bridge_tokens:${APP}`, JSON.stringify(tokensFor('ws-pro')));
    const view = renderStudio();
    await waitFor(() => expect(view.unlocked()).toBe(true), { timeout: 3000 });
    // Give any late re-evaluation a chance to lock it again.
    await new Promise((r) => setTimeout(r, 300));
    expect(view.unlocked()).toBe(true);
    expect(view.lockedSeen()).toBe(false);
    expect(requests).toContain('/entitlements');
    expect(useBillingBridge().entitlementsStore.can('custom_colors')).toBe(true);
    view.stop();
  });

  it('a workspace whose plan does not include it still sees it locked', async () => {
    localStorage.setItem(`bridge_tokens:${APP}`, JSON.stringify(tokensFor('ws-free')));
    const view = renderStudio();
    await waitFor(() => expect(view.locked()).toBe(true), { timeout: 3000 });
    expect(view.unlocked()).toBe(false);
    view.stop();
  });

  it('signing in after the page loaded reads the plan and unlocks the feature without a reload', async () => {
    const view = renderStudio();
    await waitFor(() => expect(requests).toContain(`/admin/flags-internal/flags-cache/${APP}`));
    expect(requests).not.toContain('/entitlements'); // signed out: nothing to read

    // The in-app sign-in stores the tokens and announces them.
    act(() => signIn(tokensFor('ws-pro')));
    await waitFor(() => expect(view.unlocked()).toBe(true), { timeout: 3000 });
    expect(requests).toContain('/entitlements');
    view.stop();
  });

  it('switching workspace reads the new workspace\'s plan', async () => {
    localStorage.setItem(`bridge_tokens:${APP}`, JSON.stringify(tokensFor('ws-pro')));
    const view = renderStudio();
    await waitFor(() => expect(view.unlocked()).toBe(true), { timeout: 3000 });

    const free = tokensFor('ws-free');
    act(() => signIn(free));
    await waitFor(() => expect(view.locked()).toBe(true), { timeout: 3000 });
    expect(requests.filter((p) => p === '/entitlements').length).toBeGreaterThanOrEqual(2);
    view.stop();
  });
});

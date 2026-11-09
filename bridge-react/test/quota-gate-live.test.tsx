/**
 * TBP-942 — a report that reaches a hard limit closes `<QuotaGate>` straight
 * away, without a reload, on a page that is busy re-rendering.
 *
 * Seen in the 9 Nov test runs (bridge-react 0.8.1): a Free workspace with a
 * limit of 1 could create a 2nd and 3rd code; the gate closed only after a
 * reload. The page's own `bridge.usage.report('qr_codes')` shares auth-core's
 * usage queue with the SDK's `bridge.flag_evaluations` count, which React
 * reported once per flag per render (several times per render under
 * StrictMode). The queue sends 10 events a second, oldest first, so a typing
 * user queued hundreds of evaluations ahead of the app's report and Bridge
 * only heard about it many seconds later. Every ingest in the test run's
 * network log went out in batches of exactly 10 (saturated); SvelteKit's did
 * not.
 *
 * Revert-proof: on origin/main the 25 keystrokes below queue ~300 evaluation
 * events ahead of the report, and the gate is still open after 3 s.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { useBridge as useBillingBridge } from '@nebulr-group/bridge-auth-core';
import { QuotaGate } from '../src/components/subscription/QuotaGate';
import { FeatureFlag } from '../src/flags/FeatureFlag';
import { useFlag } from '../src/flags/use-flag';
import { setBridgeFlagsInstance } from '../src/flags/registry';
import { bridge } from '../src/core/bridge';
import { BridgeProvider } from '../src/providers/bridge-provider';
import { _resetBridgeInstance } from '../src/core/bridge-instance';
import { __resetBridgeRuntime } from '../src/core/bridge-runtime';
import { __resetSnapshotStores } from '../src/core/snapshot-stores';
import { __resetDoubleCountWarning } from '../src/core/double-count-warning';
import { coalesceUsageReports } from '../src/flags/evaluation-count';

const API = 'http://api.test.local';
const APP = 'tbp-942';

function jwt(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  return `${b64({ alg: 'none' })}.${b64(claims)}.sig`;
}
const TOKENS = {
  accessToken: jwt({ sub: 'user-1', tid: 'ws-1', aid: APP, exp: Math.floor(Date.now() / 1000) + 3600 }),
  refreshToken: 'r',
  idToken: 'i',
};

const FLAGS = ['custom-colors', 'custom-logo', 'download-svg'].map((key) => ({
  key,
  state: 'on',
  valueType: 'boolean',
  onValue: true,
  offValue: false,
}));

/** What Bridge has counted for `qr_codes` this period. */
let used = 0;
/** Every `POST /usage/ingest` body, in order. */
let ingested: Array<{ metric: string; value: number }> = [];
let originalFetch: typeof fetch;
// auth-core's usage queue is durable: under Node/Bun it is a file in
// ~/.bridge/usage-queue, replayed by the next reporter — so an earlier run's
// events would be sent first, and this run's would land in the developer's
// home directory. Hide `process.versions.node` while the reporter is built and
// auth-core keeps the queue in memory, as it does in an edge runtime.
const originalVersions = process.versions;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

beforeEach(() => {
  Object.defineProperty(process, 'versions', { configurable: true, value: { ...originalVersions, node: undefined } });
  used = 0;
  ingested = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    const path = url.startsWith(API) ? url.slice(API.length).split('?')[0] : url;
    if (path === '/usage/quota/qr_codes') {
      return json(200, { metric: 'qr_codes', used, limit: 1, remaining: 1 - used, policy: 'hard', kind: 'counter', warningLevel: null });
    }
    if (path === '/usage/ingest') {
      const body = JSON.parse(String(init?.body)) as { metric: string; value: number };
      ingested.push({ metric: body.metric, value: body.value });
      if (body.metric === 'qr_codes') used += body.value;
      return json(201, {});
    }
    if (path === `/admin/flags-internal/flags-cache/${APP}`) return json(200, FLAGS);
    if (path === '/auth/token') {
      // The page's background refresh: a new token for the same session.
      return json(201, { access_token: jwt({ sub: 'user-1', tid: 'ws-1', aid: APP, exp: Math.floor(Date.now() / 1000) + 3600, iat: Date.now() }), refresh_token: 'r2', id_token: 'i' });
    }
    return json(404, {});
  }) as typeof fetch;
  // A signed-in session from an earlier visit, as a reload finds it.
  localStorage.setItem(`bridge_tokens:${APP}`, JSON.stringify(TOKENS));
  __resetBridgeRuntime();
  _resetBridgeInstance();
  __resetSnapshotStores();
  useBillingBridge().quotas.__resetForTests();
});

afterEach(() => {
  cleanup();
  Object.defineProperty(process, 'versions', { configurable: true, value: originalVersions });
  globalThis.fetch = originalFetch;
  localStorage.removeItem(`bridge_tokens:${APP}`);
  setBridgeFlagsInstance(undefined);
  __resetBridgeRuntime();
  _resetBridgeInstance();
  __resetSnapshotStores();
  useBillingBridge().quotas.__resetForTests();
  __resetDoubleCountWarning();
});

let type: (text: string) => void = () => {};

/** The QR Studio page from the test run, cut down: a text box, three flags, the gate. */
function Studio() {
  const [text, setText] = useState('');
  type = setText;
  const svg = useFlag('download-svg', false);
  return (
    <main>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      <FeatureFlag flagKey="custom-colors" defaultValue={false}>
        <span>Colors</span>
      </FeatureFlag>
      <FeatureFlag flagKey="custom-logo" defaultValue={false}>
        <span>Logo</span>
      </FeatureFlag>
      {svg.value ? <button>Download SVG</button> : null}
      <QuotaGate metric="qr_codes">
        <button onClick={() => bridge.usage.report('qr_codes', 1)}>Create QR code</button>
      </QuotaGate>
    </main>
  );
}

describe('TBP-942 — a report at the limit closes the gate without a reload', () => {
  it('closes within ~2 s on a page that has just been re-rendering, and counts every evaluation', async () => {
    const { container, getByText } = render(
      <StrictMode>
        <BridgeProvider appId={APP} config={{ apiBaseUrl: API, billing: { paywallRoute: false } }}>
          <Studio />
        </BridgeProvider>
      </StrictMode>,
    );
    const gate = () => container.querySelector('[data-bridge-quota-gate]')?.getAttribute('data-state');
    await waitFor(() => expect(gate()).toBe('available'), { timeout: 3000 });
    await waitFor(() => expect(getByText('Colors')).toBeTruthy());

    // The user types a URL: one re-render per keystroke.
    const url = 'https://example.com/free-1';
    for (let i = 1; i <= 25; i++) act(() => type(url.slice(0, i)));

    act(() => getByText('Create QR code').click());

    // Bridge accepts the report, the page reads its usage back (TBP-700) and
    // the gate closes — no reload, and well before the user could click again.
    await waitFor(() => expect(gate()).toBe('at-limit'), { timeout: 3000, interval: 50 });
    expect(used).toBe(1);
    expect((getByText('Create QR code').closest('fieldset') as HTMLFieldSetElement).disabled).toBe(true);

    // The SDK's own count is still reported in full — sent as a few summed
    // events instead of one request per evaluation.
    await new Promise((r) => setTimeout(r, 1500));
    const evaluationEvents = ingested.filter((e) => e.metric === 'bridge.flag_evaluations');
    const evaluations = evaluationEvents.reduce((n, e) => n + e.value, 0);
    expect(evaluations).toBeGreaterThan(25);
    expect(evaluationEvents.length).toBeLessThan(10);
  }, 15000);
});

describe('TBP-942 — the flag-evaluation count, summed before it is queued', () => {
  it('many reports of one metric reach the queue as one report carrying the sum', async () => {
    const seen: Array<[string, number, string | undefined]> = [];
    const counter = coalesceUsageReports({ report: (m, v = 1, k) => void seen.push([m, v, k]) }, 20);
    for (let i = 0; i < 250; i++) counter.report('bridge.flag_evaluations', 1);
    counter.report('other', 2);
    expect(seen).toEqual([]);
    await new Promise((r) => setTimeout(r, 40));
    expect(seen).toEqual([
      ['bridge.flag_evaluations', 250, undefined],
      ['other', 2, undefined],
    ]);
    counter.stop();
  });

  it('a report with its own idempotency key is one event and passes straight through', () => {
    const seen: unknown[][] = [];
    const counter = coalesceUsageReports({ report: (...a) => void seen.push(a) }, 1000);
    counter.report('exports', 1, 'k-1');
    expect(seen).toEqual([['exports', 1, 'k-1']]);
    counter.stop();
  });

  it('what has been added up is queued when the page is hidden or the bundle stops', () => {
    const seen: unknown[][] = [];
    const counter = coalesceUsageReports({ report: (...a) => void seen.push(a) }, 60_000);
    counter.report('bridge.flag_evaluations', 1);
    counter.report('bridge.flag_evaluations', 1);
    window.dispatchEvent(new Event('pagehide'));
    expect(seen).toEqual([['bridge.flag_evaluations', 2]]);
    counter.report('bridge.flag_evaluations', 1);
    counter.stop();
    expect(seen).toEqual([['bridge.flag_evaluations', 2], ['bridge.flag_evaluations', 1]]);
  });
});

describe('TBP-942 — quota reads carry the current token', () => {
  it('a new sign-in reconfigures the quota store, so the read-back after a report is not sent with the old token', async () => {
    const auths: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
      if (url.endsWith('/usage/quota/qr_codes')) {
        auths.push(new Headers(init?.headers).get('Authorization') ?? '');
        return json(200, { metric: 'qr_codes', used: 0, limit: 1, remaining: 1, policy: 'hard', warningLevel: null });
      }
      return json(404, {});
    }) as typeof fetch;
    const { initBridge, useBridgeStore } = await import('../src/core/bridge-instance');
    const { startBridgeRuntime } = await import('../src/core/bridge-runtime');
    localStorage.removeItem(`bridge_tokens:${APP}`);
    initBridge({ appId: APP, apiBaseUrl: API } as never);
    startBridgeRuntime({ realtime: { fetchFn: (async () => json(404, {})) as never, reportStatus: false, diagnose: false } });

    const other = jwt({ sub: 'user-2', tid: 'ws-2', aid: APP, exp: Math.floor(Date.now() / 1000) + 3600 });
    act(() => useBridgeStore.setState({ tokens: { accessToken: other, refreshToken: 'r' } as never }));
    useBillingBridge().quotas.ensureHydrated('qr_codes');
    await waitFor(() => expect(auths).toEqual([`Bearer ${other}`]));
  });
});

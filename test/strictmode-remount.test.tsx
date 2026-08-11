/**
 * Regression: <BridgeProvider> must survive React StrictMode's dev-only
 * double-mount (TBP-206).
 *
 * React 18/19 StrictMode simulates a full mount → unmount → remount on the SAME
 * fiber in development. The provider's cleanup tears the Bridge runtime down,
 * but the component does NOT re-render on that remount — so anything the
 * provider only did during render (the `initedRef`-guarded bootstrap) is never
 * redone. Before the fix, StrictMode left every dev session with a permanently
 * dead realtime channel: no session.snapshot fanout, no live flag updates, no
 * token-driven channel rescoping. The repo's own demo mounts in <StrictMode>.
 *
 * Two invariants are load-bearing and are asserted separately below:
 *   1. `stopBridgeRuntime()` drops its module state SYNCHRONOUSLY, so the
 *      stop → start pair StrictMode fires back-to-back in one commit actually
 *      restarts (an `await`-first stop leaves `_realtime` set, the immediate
 *      `startBridgeRuntime()` no-ops, then the stop lands and kills it).
 *   2. The provider re-asserts the runtime from a mount EFFECT, not only from
 *      render, so the remount rebuilds what the cleanup removed.
 *
 * Run with `bun test test/`. Uses jsdom directly — the package ships no
 * component-test framework, and this needs the real react-dom commit phase
 * (StrictMode's double-invoke only exists in the dev build's effect scheduler).
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { JSDOM } from 'jsdom';

// ── DOM + offline network, installed BEFORE react-dom is loaded ──────────────
// Every import below is dynamic on purpose: react-dom captures `window` at
// module scope, so it must not be hoisted above this setup.

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});
const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.navigator = dom.window.navigator;
g.HTMLElement = dom.window.HTMLElement;
g.Element = dom.window.Element;
g.Node = dom.window.Node;
g.Event = dom.window.Event;
g.CustomEvent = dom.window.CustomEvent;
g.localStorage = dom.window.localStorage;
g.sessionStorage = dom.window.sessionStorage;
g.MutationObserver = dom.window.MutationObserver;
g.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);
g.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
g.IS_REACT_ACT_ENVIRONMENT = true;

// The runtime must boot with zero reachable backend — this test is about
// lifecycle, not transport.
const offline = () => Promise.reject(new Error('offline (bridge-react unit test)'));
g.fetch = offline;
(dom.window as unknown as { fetch: unknown }).fetch = offline;

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readyState = 0;
  constructor(public readonly url: string) {}
  send(): void {}
  close(): void {
    this.readyState = 3;
  }
  addEventListener(): void {}
  removeEventListener(): void {}
}
g.WebSocket = FakeWebSocket;
(dom.window as unknown as { WebSocket: unknown }).WebSocket = FakeWebSocket;

// Best-effort background work (token refresh, app config, flag hydrate) all
// rejects against the offline stub; those rejections are expected, and so is
// the `[bridge-instance] getAppConfig failed` warning they produce. Mute the
// two channels the SDK logs them on so a real failure stays readable;
// `console.error` is deliberately left alone.
process.on('unhandledRejection', () => {});
console.warn = () => {};
console.debug = () => {};

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { BridgeProvider } = await import('../bridge-react/src/providers/bridge-provider');
const { getBridgeRealtime, startBridgeRuntime, stopBridgeRuntime, __resetBridgeRuntime } =
  await import('../bridge-react/src/core/bridge-runtime');
const { _resetBridgeInstance } = await import('../bridge-react/src/core/bridge-instance');
const { getBridgeFlagsInstance, setBridgeFlagsInstance } = await import(
  '../bridge-react/src/flags/registry'
);

const act = (React as unknown as { act: (cb: () => Promise<void>) => Promise<void> }).act;

const TEST_CONFIG = { appId: 'strictmode-test-app', apiBaseUrl: 'http://127.0.0.1:1' };

let container: HTMLElement;
let root: { render: (node: unknown) => void; unmount: () => void };

function tree(strict: boolean) {
  const provider = React.createElement(
    BridgeProvider,
    { config: TEST_CONFIG as never },
    React.createElement('div', null, 'child'),
  );
  return strict ? React.createElement(React.StrictMode, null, provider) : provider;
}

async function mount(strict: boolean): Promise<void> {
  container = dom.window.document.createElement('div');
  dom.window.document.body.appendChild(container);
  root = createRoot(container) as never;
  await act(async () => {
    root.render(tree(strict));
  });
  // Let the awaited half of stopBridgeRuntime()/flags stop() settle so a
  // teardown that "wins the race" would be visible to the assertions.
  await new Promise((r) => setTimeout(r, 50));
}

beforeEach(() => {
  __resetBridgeRuntime();
  _resetBridgeInstance();
  setBridgeFlagsInstance(undefined);
});

afterEach(() => {
  container?.remove();
});

describe('BridgeProvider — StrictMode double-mount', () => {
  test('leaves the bridge runtime live after the simulated remount', async () => {
    await mount(true);

    // The regression: this was `undefined`, for the rest of the page's life.
    expect(getBridgeRealtime()).toBeDefined();
    expect(getBridgeFlagsInstance()).toBeDefined();
    expect(container.textContent).toBe('child');
  });

  test('matches a plain (production-shaped) single mount', async () => {
    await mount(false);

    expect(getBridgeRealtime()).toBeDefined();
    expect(getBridgeFlagsInstance()).toBeDefined();
  });

  test('still tears the runtime down on a genuine unmount (no leak)', async () => {
    await mount(true);
    expect(getBridgeRealtime()).toBeDefined();

    await act(async () => {
      root.unmount();
    });
    await new Promise((r) => setTimeout(r, 50));

    expect(getBridgeRealtime()).toBeUndefined();
  });
});

describe('stopBridgeRuntime', () => {
  test('drops the runtime synchronously so an immediate restart wins', () => {
    startBridgeRuntime();
    expect(getBridgeRealtime()).toBeDefined();

    // Deliberately NOT awaited — this is exactly how the provider's cleanup
    // calls it, and how StrictMode sequences cleanup → remount effect.
    const flushed = stopBridgeRuntime();
    expect(getBridgeRealtime()).toBeUndefined();

    startBridgeRuntime();
    const restarted = getBridgeRealtime();
    expect(restarted).toBeDefined();

    // The in-flight flush of the OLD client must not clear the new one.
    return flushed.then(() => {
      expect(getBridgeRealtime()).toBe(restarted!);
    });
  });
});

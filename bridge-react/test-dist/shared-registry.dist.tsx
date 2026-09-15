/**
 * TBP-665 — the `/flags` subpath and the main entry share ONE flag registry.
 *
 * Runs against the BUILT package (`dist/`), not `src/`: the defect only exists
 * after bundling. Run with `bun run test:dist` (builds first). Deliberately
 * not named `*.test.*`, so the source suite (`bun test`) does not pick it up
 * before a build exists.
 *
 * Regression: rollup built `src/index.ts` and `src/flags/index.ts` as two
 * separate configs, so each bundle inlined its own copy of `flags/registry.ts`
 * (and of the runtime's status stores). `<BridgeProvider>` (main entry)
 * registered the flag instance in the main copy; `useFlag` imported from
 * `@nebulr-group/bridge-react/flags`, as the guides teach, read the other copy,
 * found no instance, and returned the default forever.
 */
import { afterEach, describe, expect, it } from 'bun:test';
import { createRequire } from 'node:module';
import { act, cleanup, render } from '@testing-library/react';
import * as mainEsm from '../dist/index.esm.js';
import * as flagsEsm from '../dist/flags/index.esm.js';

const require = createRequire(import.meta.url);
const mainCjs = require('../dist/index.cjs.js');
const flagsCjs = require('../dist/flags/index.cjs.js');

/** A flag instance whose answer the test can move, like a live flag push does. */
function liveInstance() {
  const state = { on: false };
  return {
    state,
    instance: {
      flag: (_key: string, fallback: unknown) =>
        state.on ? { passed: true, value: true } : { passed: false, value: fallback },
    },
  };
}

afterEach(() => {
  cleanup();
  mainEsm.setBridgeFlagsInstance(undefined);
  mainCjs.setBridgeFlagsInstance(undefined);
});

describe('ESM: the main entry and /flags share one flag registry (TBP-665)', () => {
  it('an instance registered through the main entry is visible from /flags', () => {
    const { instance } = liveInstance();
    mainEsm.setBridgeFlagsInstance(instance as never);
    expect(flagsEsm.getBridgeFlagsInstance()).toBe(instance);
  });

  it('a change notified through the main entry reaches a /flags flagStore subscriber', () => {
    const { state, instance } = liveInstance();
    mainEsm.setBridgeFlagsInstance(instance as never);
    const seen: boolean[] = [];
    const off = flagsEsm.flagStore('pro-page', false).subscribe((r: { value: boolean }) => seen.push(r.value));
    state.on = true;
    mainEsm.notifyAllFlagsChanged();
    off();
    expect(seen).toEqual([false, true]);
  });

  it('useFlag imported from /flags renders the live value the main entry registered', () => {
    const { state, instance } = liveInstance();
    function Gate() {
      const { value } = flagsEsm.useFlag('pro-page', false);
      return <span data-testid="gate">{value ? 'open' : 'locked'}</span>;
    }
    mainEsm.setBridgeFlagsInstance(instance as never);
    const { getByTestId } = render(<Gate />);
    expect(getByTestId('gate').textContent).toBe('locked');

    act(() => {
      state.on = true;
      mainEsm.notifyAllFlagsChanged();
    });
    expect(getByTestId('gate').textContent).toBe('open');
  });

  it('realtime status written by the main runtime is the one /flags exposes', () => {
    expect(flagsEsm.realtimeStatus).toBe(mainEsm.realtimeStatus);
  });
});

describe('CJS: the main entry and /flags share one flag registry (TBP-665)', () => {
  it('an instance registered through the main entry is visible from /flags', () => {
    const { instance } = liveInstance();
    mainCjs.setBridgeFlagsInstance(instance);
    expect(flagsCjs.getBridgeFlagsInstance()).toBe(instance);
  });

  it('a change notified through the main entry reaches a /flags flagStore subscriber', () => {
    const { state, instance } = liveInstance();
    mainCjs.setBridgeFlagsInstance(instance);
    const seen: boolean[] = [];
    const off = flagsCjs.flagStore('pro-page', false).subscribe((r: { value: boolean }) => seen.push(r.value));
    state.on = true;
    mainCjs.notifyAllFlagsChanged();
    off();
    expect(seen).toEqual([false, true]);
  });
});

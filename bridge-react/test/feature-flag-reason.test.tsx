/**
 * TBP-756 — a `<FeatureFlag>` fallback learns WHY the feature is off.
 *
 * auth-core 0.8 says why a flag evaluated off (`FlagEvalResult.reason`,
 * `.feature`): 'plan' when an upgrade alone would turn it on, 'permission'
 * when it is this person's role or privileges, and so on. The react fallback
 * render prop received only the value, so an app could not tell "upgrade to
 * get this" from "you are not allowed" and offered an upgrade that would not
 * have helped. bridge-svelte passes `{ reason, feature }` to its fallback; this
 * pins the same for react, and `useFlag` returning them.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { act, cleanup, render } from '@testing-library/react';
import type { BridgeFlags, FlagEvalResult } from '@nebulr-group/bridge-auth-core';
import { FeatureFlag } from '../src/flags/FeatureFlag';
import { notifyAllFlagsChanged, setBridgeFlagsInstance } from '../src/flags/registry';
import { useFlag } from '../src/flags/use-flag';

/** What the fake flag cache answers for every key. */
let answer: FlagEvalResult<boolean>;

beforeEach(() => {
  answer = { passed: false, value: false, reason: 'plan', feature: 'reports' } as FlagEvalResult<boolean>;
  setBridgeFlagsInstance({
    flag: (_key: string, _defaultValue: unknown) => answer,
  } as unknown as BridgeFlags);
});

afterEach(() => {
  cleanup();
  setBridgeFlagsInstance(undefined);
});

describe('<FeatureFlag> fallback gets the off-reason (TBP-756)', () => {
  it("off because of the plan: the fallback gets reason 'plan' and the feature", () => {
    const { getByTestId } = render(
      <FeatureFlag
        flagKey="reports"
        defaultValue={false}
        fallback={(_value, off) => <span data-testid="off">{`${off.reason}:${off.feature}`}</span>}
      >
        <span>reports</span>
      </FeatureFlag>,
    );
    expect(getByTestId('off').textContent).toBe('plan:reports');
  });

  it("off because of a permission: reason 'permission', no feature", () => {
    answer = { passed: false, value: false, reason: 'permission' } as FlagEvalResult<boolean>;
    const { getByTestId } = render(
      <FeatureFlag
        flagKey="reports"
        defaultValue={false}
        fallback={(_value, off) => <span data-testid="off">{`${off.reason}:${off.feature ?? 'none'}`}</span>}
      />,
    );
    expect(getByTestId('off').textContent).toBe('permission:none');
  });

  it('a plain-node fallback still renders as before', () => {
    const { getByTestId } = render(
      <FeatureFlag flagKey="reports" defaultValue={false} fallback={<span data-testid="off">locked</span>} />,
    );
    expect(getByTestId('off').textContent).toBe('locked');
  });

  it('a feature that is on renders children, not the fallback', () => {
    answer = { passed: true, value: true } as FlagEvalResult<boolean>;
    const { queryByTestId, getByTestId } = render(
      <FeatureFlag flagKey="reports" defaultValue={false} fallback={() => <span data-testid="off" />}>
        <span data-testid="on" />
      </FeatureFlag>,
    );
    expect(getByTestId('on')).toBeTruthy();
    expect(queryByTestId('off')).toBeNull();
  });
});

describe('useFlag returns the off-reason (TBP-756)', () => {
  function Probe() {
    const { passed, reason, feature } = useFlag('reports', false);
    return <span data-testid="probe">{`${passed}:${reason}:${feature ?? 'none'}`}</span>;
  }

  it('re-renders when only the reason changes (same value, still off)', () => {
    answer = { passed: false, value: false, reason: 'permission' } as FlagEvalResult<boolean>;
    const { getByTestId } = render(<Probe />);
    expect(getByTestId('probe').textContent).toBe('false:permission:none');

    // The role changed, the plan still lacks the feature: same value, new reason.
    answer = { passed: false, value: false, reason: 'plan', feature: 'reports' } as FlagEvalResult<boolean>;
    act(() => notifyAllFlagsChanged());
    expect(getByTestId('probe').textContent).toBe('false:plan:reports');
  });
});

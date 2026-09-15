/**
 * TBP-669 — LoginForm must show a sign-in failure instead of "Signing in…".
 *
 * On stage, a magic-link sign-in from an origin missing from the app's allowed
 * origins was accepted, then the token exchange answered 403 "Origin not
 * allowed". The auth state stayed at `credentials-validated` (auth-core before
 * TBP-669 did not reset it), and LoginForm renders every non-`unauthenticated`
 * state as the settling spinner — so the error it had caught never rendered.
 *
 * Every case drives the REAL failure path: a stubbed auth-core call that moves
 * the store the way auth-core does, then rejects. Nothing seeds component state.
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { HttpError, en } from '@nebulr-group/bridge-auth-core';
import { LoginForm } from '../src/components/sdk-auth/LoginForm';
import { _resetOriginReports } from '../src/components/sdk-auth/shared/auth-error';
import {
  getBridgeAuth,
  initBridge,
  setBridgeConfig,
  useBridgeStore,
  _resetBridgeInstance,
} from '../src/core/bridge-instance';
import { setPageOrigin } from './origin.helpers';

const ORIGIN = 'http://localhost:5181';
const FIX = `This app's allowed origins in Bridge don't include ${ORIGIN} — add it in Bridge admin under Authentication → Security → Allowed Origins.`;

/** What auth-core 0.7.0-beta.0 throws on the refusal. */
const plainRefusal = () => new HttpError('Origin not allowed', 403, { message: 'Origin not allowed' });
/** What auth-core with TBP-669 throws: OriginNotAllowedError, recognised by code. */
const codedRefusal = () => Object.assign(new HttpError(FIX, 403, { message: 'Origin not allowed' }), { code: 'ORIGIN_NOT_ALLOWED' });

function setState(authState: string) {
  act(() => {
    useBridgeStore.setState({ authState, isLoading: false } as any);
  });
}

/** Stub an auth-core method: move the store to `stateOnFailure`, then reject. */
function failWith(method: string, stateOnFailure: string, err: unknown) {
  (getBridgeAuth() as any)[method] = async () => {
    useBridgeStore.setState({ authState: stateOnFailure } as any);
    throw err;
  };
}

const settling = (c: HTMLElement) => c.querySelector('[data-bridge-auth-settling]');
const passwordField = (c: HTMLElement) => c.querySelector('input[type="password"]');
const alertText = (c: HTMLElement) => c.querySelector('[data-bridge-alert], .bridge-alert')?.textContent ?? '';

function submitPassword(container: HTMLElement) {
  fireEvent.change(container.querySelector('#login-email')!, { target: { value: 'ada@example.com' } });
  fireEvent.change(container.querySelector('#login-password')!, { target: { value: 'hunter22' } });
  fireEvent.submit(container.querySelector('form')!);
}

let restoreOrigin: () => void;
let consoleError: ReturnType<typeof spyOn>;
/** Console lines about the origin refusal — unrelated boot noise is ignored. */
const originLines = () =>
  consoleError.mock.calls.map((c: unknown[]) => String(c[0])).filter((l: string) => l.includes('Origin not allowed'));
beforeEach(() => {
  restoreOrigin = setPageOrigin(ORIGIN);
  consoleError = spyOn(console, 'error').mockImplementation(() => {});
  _resetOriginReports();
  _resetBridgeInstance();
  initBridge({ appId: 'tbp-669' } as any);
  setBridgeConfig({ appId: 'tbp-669' } as any);
  setState('unauthenticated');
});
afterEach(() => {
  cleanup();
  consoleError.mockRestore();
  restoreOrigin();
  _resetBridgeInstance();
  setBridgeConfig(null as any);
  useBridgeStore.setState({ authState: 'unauthenticated', tenantUsers: [] } as any);
});

describe('LoginForm shows a failed token exchange (TBP-669)', () => {
  it('older auth-core: the state stays at credentials-validated — the form shows the fix, not "Signing in…"', async () => {
    failWith('authenticate', 'credentials-validated', plainRefusal());
    const { container } = render(<LoginForm />);
    submitPassword(container);
    await waitFor(() => expect(alertText(container)).toBe(FIX));
    expect(settling(container)).toBeNull();
    // The user can try again from the same screen.
    expect(passwordField(container)).not.toBeNull();
    // The one console line an older auth-core does not print itself.
    expect(originLines()).toHaveLength(1);
  });

  it('auth-core with TBP-669: the state resets, and the coded error shows the fix', async () => {
    failWith('authenticate', 'unauthenticated', codedRefusal());
    const { container } = render(<LoginForm />);
    submitPassword(container);
    await waitFor(() => expect(alertText(container)).toBe(FIX));
    expect(settling(container)).toBeNull();
    // auth-core already logged it.
    expect(originLines()).toHaveLength(0);
  });

  it('magic-link token exchange: leaves the loading state and shows the fix', async () => {
    restoreOrigin();
    restoreOrigin = setPageOrigin(ORIGIN, '/login?bridge_magic_link_token=tok');
    failWith('authenticateWithMagicLinkToken', 'credentials-validated', plainRefusal());
    const { container } = render(<LoginForm />);
    await waitFor(() => expect(alertText(container)).toBe(FIX));
    expect(settling(container)).toBeNull();
    expect(container.textContent).not.toContain(en['login.submitting']);
  });

  it('other 403s keep their own message', async () => {
    failWith('authenticate', 'unauthenticated', new HttpError('User is disabled', 403, { message: 'User is disabled' }));
    const { container } = render(<LoginForm />);
    submitPassword(container);
    await waitFor(() => expect(alertText(container)).toBe('User is disabled'));
    expect(originLines()).toHaveLength(0);
  });

  it('a stale error from an earlier attempt does not hijack a later sign-in (TBP-635 still holds)', async () => {
    failWith('authenticate', 'unauthenticated', new HttpError('Invalid credentials', 401, { message: 'Invalid credentials' }));
    const { container } = render(<LoginForm />);
    submitPassword(container);
    await waitFor(() => expect(alertText(container)).toBe('Invalid credentials'));
    // e.g. a passkey sign-in that succeeds afterwards.
    setState('credentials-validated');
    expect(settling(container)).not.toBeNull();
    expect(passwordField(container)).toBeNull();
  });
});

describe('child errors reach LoginForm (TBP-669)', () => {
  it('an origin refusal during MFA ends the sign-in, and the credentials form shows why', async () => {
    setState('mfa-required');
    failWith('verifyMfa', 'unauthenticated', plainRefusal());
    const { container } = render(<LoginForm />);
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(passwordField(container)).not.toBeNull());
    expect(alertText(container)).toBe(FIX);
  });

  it('a passkey sign-in refused at the token exchange shows the fix instead of the spinner', async () => {
    failWith('authenticateWithPasskey', 'credentials-validated', plainRefusal());
    const { container, getByText } = render(<LoginForm showPasskeys />);
    fireEvent.click(getByText(en['passkey.loginButton']));
    await waitFor(() => expect(alertText(container)).toBe(FIX));
    expect(settling(container)).toBeNull();
  });

  it('other MFA errors stay with MFA', async () => {
    setState('mfa-required');
    failWith('verifyMfa', 'mfa-required', new HttpError('Invalid code', 400, { message: 'Invalid code' }));
    const { container } = render(<LoginForm />);
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(alertText(container)).toBe('Invalid code'));
    expect(passwordField(container)).toBeNull();
  });
});

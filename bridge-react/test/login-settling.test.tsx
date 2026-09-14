/**
 * TBP-635 — LoginForm must never draw the credentials form to somebody who has
 * already authenticated.
 *
 * The top-level branch named `mfa-required`, `mfa-setup-required` and
 * `tenant-selection`, and let everything else fall through to the password
 * form. `authenticated` and `credentials-validated` are also "everything else",
 * so between the token exchange resolving and the host app's router landing —
 * LoginForm fires `onLogin` and deliberately does not navigate — the component
 * showed a password field to a user who had just typed their password
 * correctly. That reads as a refusal. Measured at 600ms against a local stack.
 *
 * Two kinds of assertion here, because the defect has two halves.
 *
 * 1. An EXHAUSTIVE sweep of `AuthState`, read out of auth-core's shipped type
 *    declaration rather than hardcoded. The bug was an unhandled branch, so the
 *    guard that prevents recurrence is "exactly one state renders a password
 *    field" — a seventh state added to auth-core tomorrow is covered the moment
 *    it exists.
 *
 * 2. A MutationObserver over the real transition, per the ticket: a sampling
 *    loop can miss a race, so record every DOM batch instead and assert the
 *    password field never appeared in any of them.
 */
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { render, cleanup, act } from '@testing-library/react';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { LoginForm } from '../src/components/sdk-auth/LoginForm';
import {
  initBridge,
  setBridgeConfig,
  useBridgeStore,
  _resetBridgeInstance,
} from '../src/core/bridge-instance';
import { en, sv } from '@nebulr-group/bridge-auth-core';

/**
 * Every `AuthState`, parsed out of the auth-core declaration the package
 * actually ships.
 *
 * Deliberately not a literal list: a hardcoded one would still say six when
 * auth-core says seven, and the bug being fixed is precisely a state nobody
 * remembered to handle. Parsing throws rather than returning a short list, so a
 * refactor that moves the type fails this suite loudly instead of quietly
 * testing fewer states.
 */
function authStates(): string[] {
  const candidates = [
    path.resolve('node_modules/@nebulr-group/bridge-auth-core/dist/types.d.ts'),
    path.resolve('../node_modules/@nebulr-group/bridge-auth-core/dist/types.d.ts'),
  ];
  const dts = candidates.find((c) => fs.existsSync(c));
  if (!dts) throw new Error(`auth-core types.d.ts not found in:\n  ${candidates.join('\n  ')}`);
  const match = fs.readFileSync(dts, 'utf8').match(/export type AuthState\s*=([^;]+);/);
  if (!match) throw new Error('Could not find `export type AuthState` in auth-core types.d.ts.');
  const states = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  if (states.length < 2) throw new Error(`Parsed only ${states.length} AuthState members.`);
  return states;
}

const STATES = authStates();

function boot(locale?: string) {
  _resetBridgeInstance();
  initBridge({ appId: 'tbp-635' } as any);
  setBridgeConfig({ appId: 'tbp-635', locale } as any);
}

/**
 * Drive the store the way auth-core does, inside `act` so React commits before
 * the assertion. Outside it, a passing assertion would only mean the render had
 * not happened yet.
 */
function setState(authState: string) {
  act(() => {
    useBridgeStore.setState({ authState, isLoading: false } as any);
  });
}

const passwordField = (c: HTMLElement) => c.querySelector('input[type="password"]');

afterEach(() => {
  cleanup();
  _resetBridgeInstance();
  setBridgeConfig(null as any);
  useBridgeStore.setState({ authState: 'unauthenticated', tenantUsers: [] } as any);
});

// ---------------------------------------------------------------------------
// 1. The fixture itself
// ---------------------------------------------------------------------------

describe('AuthState coverage (TBP-635)', () => {
  it('reads the real state list out of the shipped auth-core types', () => {
    expect(STATES).toContain('unauthenticated');
    expect(STATES).toContain('authenticated');
    expect(STATES).toContain('credentials-validated');
    expect(STATES.length).toBeGreaterThanOrEqual(6);
  });
});

// ---------------------------------------------------------------------------
// 2. Exhaustive: exactly one state may render a password field
// ---------------------------------------------------------------------------

describe('LoginForm never shows the credentials form post-auth (TBP-635)', () => {
  it('renders a password field for `unauthenticated` and for nothing else', () => {
    const withPassword: string[] = [];
    for (const state of STATES) {
      boot();
      setState(state);
      const { container } = render(<LoginForm />);
      if (passwordField(container)) withPassword.push(state);
      cleanup();
    }
    // Both directions. Asserting only "authenticated has no password field"
    // would pass for a component that rendered nothing at all, ever.
    expect(withPassword).toEqual(['unauthenticated']);
  });

  for (const state of ['authenticated', 'credentials-validated']) {
    it(`shows the settling card at "${state}"`, () => {
      boot();
      setState(state);
      const { container } = render(<LoginForm />);
      expect(container.querySelector('[data-bridge-auth-settling]')).not.toBeNull();
      expect(passwordField(container)).toBeNull();
      // Not a blank card: an empty box during a pause is its own bad message.
      expect(container.textContent).toContain(en['login.submitting']);
    });
  }

  it('translates the waiting copy', () => {
    boot('sv');
    setState('authenticated');
    const { container } = render(<LoginForm />);
    expect(container.textContent).toContain(sv['login.submitting']);
    expect(container.textContent).not.toContain(en['login.submitting']);
  });

  it('suppresses the heading while settling, so no stale "Log in" survives', () => {
    boot();
    setState('authenticated');
    const { container } = render(<LoginForm heading="Log in to NorthWhistle" />);
    expect(container.textContent).not.toContain('Log in to NorthWhistle');
    expect(container.querySelector('[data-bridge-auth-settling]')).not.toBeNull();
  });

  it('still hands the delegated states to their own components', () => {
    // The fix must not have swallowed the branches that already worked — an
    // over-eager `!== unauthenticated` placed above them would do exactly that.
    boot();
    setState('tenant-selection');
    const { container } = render(<LoginForm />);
    expect(container.querySelector('.bridge-tenant-list')).not.toBeNull();
    cleanup();

    boot();
    setState('mfa-required');
    const mfa = render(<LoginForm />);
    expect(mfa.container.textContent).toContain(en['mfa.challengeHeading']);
  });

  it('leaves the unauthenticated step machine alone', () => {
    boot();
    setState('unauthenticated');
    const { container } = render(<LoginForm />);
    expect(passwordField(container)).not.toBeNull();
    expect(container.querySelector('[data-bridge-auth-settling]')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. The race, recorded rather than sampled
// ---------------------------------------------------------------------------

describe('no password field appears during the settle window (TBP-635)', () => {
  /**
   * Record every DOM batch, per the ticket's test strategy. A poll that happens
   * to land either side of a 600ms flash would report the bug fixed.
   *
   * Presence, not `checkVisibility()`: the ticket asks for visibility because a
   * consumer working around this bug hides the form rather than unmounting it
   * (LoginForm is what fires `onLogin`, so it has to stay mounted). Inside this
   * component we control the branch, so the form must be absent outright —
   * a stricter bar than the workaround needs.
   */
  async function recordTransition(states: string[]): Promise<Set<string>> {
    boot();
    setState('unauthenticated');
    const { container } = render(<LoginForm />);

    const seen = new Set<string>();
    const look = () => {
      if (passwordField(container)) seen.add('credentials');
      if (container.querySelector('[data-bridge-auth-settling]')) seen.add('settling');
      if (container.querySelector('.bridge-tenant-list')) seen.add('tenant');
    };

    // Two recorders, because neither alone is enough.
    //
    // The MutationObserver is the ticket's suggestion: it can catch a DOM that
    // appears and disappears BETWEEN two commits, which is the flash this bug
    // is about. But happy-dom coalesces batches unpredictably — observed
    // delivering one callback for a two-transition run — so relying on it alone
    // makes the result depend on scheduling rather than on the component.
    //
    // The per-commit `look()` after each awaited transition is the
    // deterministic half: every state React actually commits is inspected, with
    // no dependence on observer delivery. This is not interval sampling, which
    // is what the ticket rightly warns against.
    const observer = new MutationObserver(look);
    observer.observe(container, { childList: true, subtree: true, attributes: true });

    for (const s of states) {
      setState(s);
      await new Promise((r) => setTimeout(r, 0));
      look();
    }

    if (observer.takeRecords().length > 0) look();
    observer.disconnect();
    return seen;
  }

  it('multi-workspace path: tenant-selection → authenticated', async () => {
    useBridgeStore.setState({
      tenantUsers: [{ id: 't1', fullName: 'Ada', tenant: { id: 'x', name: 'Acme', logo: null } }],
    } as any);
    const seen = await recordTransition(['tenant-selection', 'authenticated']);
    expect(seen.has('tenant')).toBe(true);
    expect(seen.has('settling')).toBe(true);
    expect(seen.has('credentials')).toBe(false);
  });

  it('single-workspace path: straight to authenticated', async () => {
    const seen = await recordTransition(['authenticated']);
    expect(seen.has('settling')).toBe(true);
    expect(seen.has('credentials')).toBe(false);
  });

  it('the recorder actually records — it catches a credentials render', async () => {
    // Vacuity guard. Without this, a broken observer would make both tests
    // above pass by seeing nothing at all.
    const seen = await recordTransition(['unauthenticated', 'mfa-required', 'unauthenticated']);
    expect(seen.has('credentials')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. onLogin is untouched
// ---------------------------------------------------------------------------

describe('onLogin lifecycle is unchanged (TBP-635)', () => {
  it('fires exactly once, when the state reaches `authenticated`', () => {
    // The tempting wrong fix is to move `onLogin` earlier so the consumer
    // navigates sooner — which would fire it before the session is real.
    boot();
    setState('unauthenticated');
    const onLogin = mock(() => {});
    render(<LoginForm onLogin={onLogin} />);
    expect(onLogin).not.toHaveBeenCalled();

    setState('credentials-validated');
    expect(onLogin).not.toHaveBeenCalled();

    setState('authenticated');
    expect(onLogin).toHaveBeenCalledTimes(1);
  });
});

/**
 * TBP-743 / TBP-515 (passkeys) — the React passkey components run the real
 * WebAuthn ceremony against auth-core's API.
 *
 * Found while porting: all three called auth-core methods that do not exist
 * (`registerPasskeyWithToken`, `sendPasskeySetupLink`) or skipped the
 * authenticator (`authenticateWithPasskey()` with no answer), so an emailed
 * setup link always failed and a passkey sign-in never reached an
 * authenticator. Revert-proof: on origin/main every test here fails (the
 * setup test sees "Passkey setup failed.", the others never see the calls).
 *
 * The authenticator is `window.__simpleWebAuthn`, the same hook bridge-svelte's
 * e2e suite uses for its virtual authenticator.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { en } from '@nebulr-group/bridge-auth-core';
import { PasskeyLogin } from '../src/components/sdk-auth/PasskeyLogin';
import { PasskeySetup } from '../src/components/sdk-auth/PasskeySetup';
import { PasskeyRequestSetupLink } from '../src/components/sdk-auth/PasskeyRequestSetupLink';
import { _resetBridgeInstance, getBridgeAuth, initBridge } from '../src/core/bridge-instance';

const w = window as unknown as Record<string, unknown>;
let calls: string[];
let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('{}', { status: 404 })) as unknown as typeof fetch;
  _resetBridgeInstance();
  initBridge({ appId: 'tbp-743', apiBaseUrl: 'http://api.test.local' } as never);
  calls = [];
  w.PublicKeyCredential = function PublicKeyCredential() {};
  w.__simpleWebAuthn = {
    startAuthentication: async ({ optionsJSON }: { optionsJSON: { challenge: string } }) => {
      calls.push(`authenticator:sign:${optionsJSON.challenge}`);
      return { id: 'assertion-1' };
    },
    startRegistration: async ({ optionsJSON }: { optionsJSON: { challenge: string } }) => {
      calls.push(`authenticator:create:${optionsJSON.challenge}`);
      return { id: 'credential-1' };
    },
  };
  const auth = getBridgeAuth() as unknown as Record<string, unknown>;
  auth.getPasskeyAuthOptions = async () => {
    calls.push('bridge:auth-options');
    return { challenge: 'login-challenge' };
  };
  auth.authenticateWithPasskey = async (response: { id: string }) => {
    calls.push(`bridge:authenticate:${response?.id}`);
    return {};
  };
  auth.getPasskeyRegistrationOptions = async (token: string) => {
    calls.push(`bridge:registration-options:${token}`);
    return { challenge: 'setup-challenge' };
  };
  auth.verifyPasskeyRegistration = async (credential: { id: string }, token: string) => {
    calls.push(`bridge:verify:${credential?.id}:${token}`);
    return { verified: true };
  };
  auth.requestPasskeySetupLink = async (email: string) => {
    calls.push(`bridge:setup-link:${email}`);
    return { success: true };
  };
});

afterEach(() => {
  cleanup();
  delete w.PublicKeyCredential;
  delete w.__simpleWebAuthn;
  globalThis.fetch = originalFetch;
  _resetBridgeInstance();
});

describe('passkeys', () => {
  it('sign-in: options from Bridge → the authenticator → its answer back to Bridge', async () => {
    let signedIn = false;
    const { getByText } = render(<PasskeyLogin onLogin={() => (signedIn = true)} />);
    fireEvent.click(getByText(en['passkey.loginButton']));
    await waitFor(() => expect(signedIn).toBe(true));
    expect(calls).toEqual(['bridge:auth-options', 'authenticator:sign:login-challenge', 'bridge:authenticate:assertion-1']);
  });

  it('sign-in: the button is hidden where the browser has no passkeys', () => {
    delete w.PublicKeyCredential;
    const { container } = render(<PasskeyLogin />);
    expect(container.innerHTML).toBe('');
  });

  it('setup from an emailed link: registration options for the token → a new credential → verified', async () => {
    const { getByText, container } = render(<PasskeySetup token="tok-9" />);
    fireEvent.click(getByText(en['passkey.setupSubmit']));
    await waitFor(() => expect(container.textContent).toContain(en['passkey.setupSuccessDescription']));
    expect(calls).toEqual([
      'bridge:registration-options:tok-9',
      'authenticator:create:setup-challenge',
      'bridge:verify:credential-1:tok-9',
    ]);
  });

  it('setup: an expired link says so and offers a new one', async () => {
    (getBridgeAuth() as unknown as Record<string, unknown>).getPasskeyRegistrationOptions = async () => {
      throw new Error('Token expired');
    };
    let expired = false;
    const { getByText, container } = render(<PasskeySetup token="old" onExpired={() => (expired = true)} />);
    fireEvent.click(getByText(en['passkey.setupSubmit']));
    await waitFor(() => expect(container.textContent).toContain(en['passkey.error.expired']));
    fireEvent.click(getByText(en['passkey.requestNewLink']));
    expect(expired).toBe(true);
  });

  it('requesting a setup link calls auth-core’s requestPasskeySetupLink', async () => {
    const { container } = render(<PasskeyRequestSetupLink />);
    fireEvent.change(container.querySelector('input[type="email"]')!, { target: { value: 'ada@example.com' } });
    fireEvent.submit(container.querySelector('form')!);
    await waitFor(() => expect(calls).toEqual(['bridge:setup-link:ada@example.com']));
  });
});

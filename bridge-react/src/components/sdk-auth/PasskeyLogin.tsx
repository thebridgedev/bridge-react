import type { ButtonHTMLAttributes } from 'react';
import { useEffect, useState } from 'react';
import type { MessageOverrides } from '@nebulr-group/bridge-auth-core';
import { getBridgeAuth } from '../../core/bridge-instance';
import { getTranslator } from '../../i18n';
import { authErrorMessage, isOriginNotAllowed } from './shared/auth-error';
import { Spinner } from './shared/Spinner';
import { passkeysSupported, startPasskeyAuthentication } from '../../core/webauthn';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onError'> {
  onLogin?: () => void;
  onError?: (error: Error) => void;
  onSetupPasskey?: () => void;
  setupHref?: string;
  /** Offer passkeys in the browser's autofill (conditional mediation). */
  autofill?: boolean;
  /** Button label. Defaults to the catalogue's `passkey.loginButton`. */
  label?: string;
  /** Per-key copy overrides for this component only (TBP-630). */
  messages?: MessageOverrides;
}

export function PasskeyLogin({
  onLogin,
  onError,
  onSetupPasskey,
  setupHref,
  autofill = false,
  label,
  messages,
  className,
  style,
  ...rest
}: Props) {
  const t = getTranslator(messages);
  const [loading, setLoading] = useState(false);
  // Hidden where the browser cannot run a passkey ceremony (as bridge-svelte).
  // Read after mount, so a server render and the first client render agree.
  const [supported, setSupported] = useState(false);
  useEffect(() => setSupported(passkeysSupported()), []);

  // TBP-743 / TBP-515 — the real ceremony: options from Bridge, the
  // authenticator in the browser, the signed answer back to Bridge. This used
  // to call `authenticateWithPasskey()` with no answer at all, so no
  // authenticator was ever asked and the sign-in could not succeed.
  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      const auth = getBridgeAuth();
      const options = await auth.getPasskeyAuthOptions();
      const response = await startPasskeyAuthentication(options, autofill);
      await auth.authenticateWithPasskey(response);
      onLogin?.();
    } catch (err: any) {
      // The authenticator refused or found no passkey: offer to create one.
      if (err?.name === 'NotAllowedError' && (onSetupPasskey || setupHref)) {
        if (onSetupPasskey) onSetupPasskey();
        else if (setupHref && typeof window !== 'undefined') window.location.href = setupHref;
        return;
      }
      if (err?.name === 'NotAllowedError') {
        onError?.(new Error(t('passkey.error.authCancelled')));
        return;
      }
      // TBP-669 — the origin refusal travels as-is (code / status intact), so
      // LoginForm can recognise it and show the fix instead of "Signing in…".
      onError?.(isOriginNotAllowed(err) ? err : new Error(authErrorMessage(err, t, 'passkey.error.auth')));
    } finally {
      setLoading(false);
    }
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      className={className}
      style={style}
      data-bridge-passkey-login
      data-loading={loading}
      onClick={handleClick}
      disabled={loading}
      {...rest}
    >
      {loading ? <Spinner size={16} /> : null}
      <span>{label ?? t('passkey.loginButton')}</span>
    </button>
  );
}

export default PasskeyLogin;

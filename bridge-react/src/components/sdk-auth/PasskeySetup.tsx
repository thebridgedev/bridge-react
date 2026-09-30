import type { HTMLAttributes, ReactNode } from 'react';
import { useState } from 'react';
import type { MessageOverrides } from '@nebulr-group/bridge-auth-core';
import { getBridgeAuth } from '../../core/bridge-instance';
import { getTranslator } from '../../i18n';
import { authErrorMessage } from './shared/auth-error';
import { AuthFormWrapper } from './shared/AuthFormWrapper';
import { Alert } from './shared/Alert';
import { Spinner } from './shared/Spinner';
import { passkeysSupported, startPasskeyRegistration } from '../../core/webauthn';

interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'onError'> {
  token: string;
  onComplete?: () => void;
  onError?: (error: Error) => void;
  loginHref?: string;
  /** Heading text. Pass `null`/`''` to render no heading and use your own page title. */
  heading?: string | null;
  /**
   * The heading as a node, replacing the built-in one on the main step only
   * (the form). Result states keep their own heading, so two never stack.
   * `<BridgeAuthRoutes heading>` passes its per-page heading here (TBP-743).
   */
  headingSlot?: ReactNode;
  /**
   * Step description. Pass `null`/`''` to render nothing and use your own
   * subtitle (TBP-631).
   *
   * The built-in is `passkey.setupClickPrompt`, not `passkey.setupDescription`:
   * this screen waits for a click before it raises the browser ceremony, so the
   * "follow the prompt from your browser" copy would be describing something
   * that has not started (TBP-633).
   */
  description?: string | null;
  /** Per-key copy overrides for this component only (TBP-630). */
  messages?: MessageOverrides;
  /** The link has expired: offer "Request new setup link" (as bridge-svelte). */
  onExpired?: () => void;
}

type SetupError = 'expired' | 'cancelled' | 'unsupported' | 'general';

function classifyError(err: any): SetupError {
  if (err?.name === 'NotAllowedError') return 'cancelled';
  const msg = String(err?.message ?? '').toLowerCase();
  if (msg.includes('expired') || msg.includes('invalid token') || msg.includes('not found')) return 'expired';
  return 'general';
}

export function PasskeySetup({
  token,
  onComplete,
  onError,
  loginHref = '/auth/login',
  heading,
  headingSlot,
  description,
  messages,
  onExpired,
  className,
  style,
  ...rest
}: Props) {
  const t = getTranslator(messages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<SetupError | null>(null);
  const [done, setDone] = useState(false);

  const builtInHeading = done ? t('passkey.setupSuccessHeading') : t('passkey.setupHeading');
  const wrapperHeading = heading !== undefined ? heading : builtInHeading;
  // Only the pre-click view has a description; the success view's copy is the
  // Alert below it.
  const wrapperDescription = done
    ? null
    : description !== undefined
      ? description
      : t('passkey.setupClickPrompt');

  // TBP-743 / TBP-515 — the real ceremony: registration options for this
  // link's token from Bridge, the authenticator in the browser, the new
  // credential back to Bridge to verify. This used to call a
  // `registerPasskeyWithToken()` that auth-core does not have, so every
  // emailed setup link ended in "Passkey setup failed."
  async function handleRegister() {
    if (loading) return;
    setError(null);
    setErrorType(null);
    if (!passkeysSupported()) {
      setErrorType('unsupported');
      setError(t('passkey.error.unsupported'));
      return;
    }
    setLoading(true);
    try {
      const auth = getBridgeAuth();
      const options = await auth.getPasskeyRegistrationOptions(token);
      const credential = await startPasskeyRegistration(options);
      const result = await auth.verifyPasskeyRegistration(credential, token);
      if (!result?.verified) {
        setErrorType('general');
        setError(t('passkey.error.verify'));
        return;
      }
      setDone(true);
      onComplete?.();
    } catch (err: any) {
      const type = classifyError(err);
      setErrorType(type);
      setError(
        type === 'cancelled'
          ? t('passkey.error.cancelled')
          : type === 'expired'
            ? t('passkey.error.expired')
            : authErrorMessage(err, t, 'passkey.error.setupFailed'),
      );
      onError?.(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFormWrapper
      heading={wrapperHeading}
      headingSlot={done ? undefined : headingSlot}
      description={wrapperDescription}
      className={className}
      style={style}
      {...rest}
    >
      {error && <Alert variant={errorType === 'unsupported' ? 'info' : 'error'}>{error}</Alert>}
      {errorType === 'expired' && onExpired ? (
        <button type="button" className="bridge-btn bridge-btn-secondary" onClick={() => onExpired()}>
          {t('passkey.requestNewLink')}
        </button>
      ) : null}

      {done ? (
        <>
          <Alert variant="success">{t('passkey.setupSuccessDescription')}</Alert>
          <div className="bridge-form-footer">
            <a href={loginHref}>{t('passkey.signInNow')}</a>
          </div>
        </>
      ) : (
        <button
          type="button"
          className="bridge-btn bridge-btn-primary"
          onClick={handleRegister}
          disabled={loading}
        >
          {loading ? <Spinner size={16} /> : t('passkey.setupSubmit')}
        </button>
      )}
    </AuthFormWrapper>
  );
}

export default PasskeySetup;

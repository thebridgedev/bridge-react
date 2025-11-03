import { useAuth } from '@nebulr-group/bridge-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

type CallbackState = 'idle' | 'processing' | 'success' | 'error';

function CallbackPage() {
  const { handleCallback } = useAuth();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<CallbackState>('idle');
  const [message, setMessage] = useState<string>('Awaiting OAuth response…');

  const code = searchParams.get('code');
  const callbackError = searchParams.get('error');

  useEffect(() => {
    const processCallback = async () => {
      if (callbackError) {
        setState('error');
        setMessage(`bridge returned an error: ${callbackError}`);
        return;
      }

      if (!code) {
        setState('error');
        setMessage('Missing ?code parameter. Double-check VITE_BRIDGE_CALLBACK_URL.');
        return;
      }

      try {
        setState('processing');
        setMessage('Validating code with bridge…');
        await handleCallback(code);
        setState('success');
        setMessage('Authentication complete. You can continue to the dashboard.');
      } catch (err) {
        setState('error');
        setMessage(err instanceof Error ? err.message : 'Failed to handle OAuth callback');
      }
    };

    processCallback();
  }, [callbackError, code, handleCallback]);

  return (
    <div className="page-section">
      <h1 className="page-heading">Completing sign-in…</h1>
      <p className="page-subheading">
        This route matches <code>VITE_BRIDGE_CALLBACK_URL</code>. The code exchange runs entirely on the client via
        <code>useAuth().handleCallback</code>.
      </p>

      <div className="card">
        {state === 'processing' && <div className="loading-banner">{message}</div>}
        {state === 'success' && <div className="success-banner">{message}</div>}
        {state === 'error' && <div className="error-banner">{message}</div>}

        <div className="link-list" style={{ marginTop: '1.5rem' }}>
          <Link to="/dashboard">Go to dashboard</Link>
          <Link to="/login">Back to login</Link>
        </div>
      </div>

      <section className="page-section">
        <div className="card">
          <h3>Callback parameters</h3>
          <div className="status-grid">
            <div className="status-box">
              <div className="status-label">code</div>
              <div className="status-value">{code ?? '–'}</div>
            </div>
            <div className="status-box">
              <div className="status-label">error</div>
              <div className="status-value">{callbackError ?? '–'}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default CallbackPage;


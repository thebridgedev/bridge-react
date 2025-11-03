import { Login, useAuth } from '@nebulr-group/bridge-react';
import { Link } from 'react-router-dom';

function LoginPage() {
  const { login, isAuthenticated, isLoading, error } = useAuth();

  return (
    <div className="page-section">
      <h1 className="page-heading">Authentication flow</h1>
      <p className="page-subheading">
        This page demonstrates both the drop-in <code>&lt;Login /&gt;</code> component and the imperative
        <code>useAuth().login()</code> helper. The redirect URI must match <code>VITE_BRIDGE_CALLBACK_URL</code>.
      </p>

      <div className="grid-cols-2 grid">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Drop-in experience</h3>
            <span className="badge">Recommended</span>
          </div>
          <p className="muted">One line of JSX that handles redirects, loading states, and configuration.</p>
          <Login />
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Custom trigger</h3>
            <span className="badge">useAuth().login</span>
          </div>
          <p className="muted">Useful when you need a tailored button or want to invoke login from a menu.</p>
          <button
            type="button"
            className="primary-button"
            onClick={() => login()}
            disabled={isLoading}
          >
            {isLoading ? 'Redirecting…' : 'Login with bridge'}
          </button>
        </div>
      </div>

      <div className="page-section">
        <div className="card">
          <h3>Status</h3>
          <div className="status-grid">
            <div className="status-box">
              <div className="status-label">Authenticated</div>
              <div className="status-value">{isAuthenticated ? 'Yes' : 'No'}</div>
            </div>
            <div className="status-box">
              <div className="status-label">Loading</div>
              <div className="status-value">{isLoading ? 'Checking…' : 'Idle'}</div>
            </div>
          </div>
          {error && <div className="error-banner">{error}</div>}
          {isAuthenticated && (
            <div className="success-banner">
              You are signed in. Continue to the <Link to="/dashboard">dashboard</Link>.
            </div>
          )}
        </div>
      </div>

      <section className="page-section">
        <div className="card">
          <h3>Implementation snippet</h3>
          <pre className="code-block">
{`import { Login, useAuth } from '@nebulr-group/bridge-react';

function LoginButtons() {
  const { login } = useAuth();
  return (
    <>
      <Login />
      <button onClick={() => login()}>Login</button>
    </>
  );
}`}
          </pre>
        </div>
      </section>
    </div>
  );
}

export default LoginPage;


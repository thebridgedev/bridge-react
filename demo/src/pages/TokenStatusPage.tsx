import { TokenStatus, useBridgeToken } from '@nebulr-group/bridge-react';

function TokenStatusPage() {
  const { getAccessToken, getRefreshToken, getIdToken } = useBridgeToken();

  return (
    <div className="page-section">
      <h1 className="page-heading">Token diagnostics</h1>
      <p className="page-subheading">
        Combines <code>TokenStatus</code> with helper methods from <code>useBridgeToken()</code> so you can inspect the
        raw token values while developing.
      </p>

      <div className="token-status-wrapper">
        <TokenStatus />

        <div className="card">
          <h3>Raw tokens</h3>
          <p className="muted">These values are pulled directly from local storage/cookies. Do not log them in production.</p>
          <div className="token-status-grid">
            <div className="status-box">
              <div className="status-label">Access token</div>
              <div className="status-value">{truncate(getAccessToken())}</div>
            </div>
            <div className="status-box">
              <div className="status-label">Refresh token</div>
              <div className="status-value">{truncate(getRefreshToken())}</div>
            </div>
            <div className="status-box">
              <div className="status-label">ID token</div>
              <div className="status-value">{truncate(getIdToken())}</div>
            </div>
          </div>
        </div>
      </div>

      <section className="page-section">
        <div className="card">
          <h3>Why this matters</h3>
          <ul className="list">
            <li>Verify automatic refresh behaviour before wiring server-side middleware.</li>
            <li>Ensure tokens are cleared correctly on logout.</li>
            <li>Decode the ID token to inspect profile claims.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

function truncate(value: string | null) {
  if (!value) {
    return '—';
  }
  if (value.length <= 16) {
    return value;
  }
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export default TokenStatusPage;


import { FeatureFlag, useAuth } from '@nebulr-group/bridge-react';
import { Link } from 'react-router-dom';

const FEATURE_FLAG_NAME = 'demo-flag';

function HomePage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="page-section">
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">bridge for React</h1>
          <p className="hero-subtitle">
            A production-ready starter that connects authentication, feature flags, team management and subscriptions.
            Explore the flows, copy the patterns, and ship faster.
          </p>
          <div className="hero-cta">
            {isAuthenticated ? (
              <Link className="primary-button" to="/dashboard">
                Go to dashboard
              </Link>
            ) : (
              <Link className="primary-button" to="/login">
                Start authentication flow
              </Link>
            )}
            <Link className="secondary-button" to="/feature-flags">
              View feature flag examples
            </Link>
          </div>
        </div>
        <div className="card highlight-card">
          <h3>Live feature flag demo</h3>
          <p className="muted">
            Toggle <code>{FEATURE_FLAG_NAME}</code> in bridge Control Center to see the UI update instantly.
          </p>
          <FeatureFlag
            flagKey={FEATURE_FLAG_NAME}
            defaultValue={false}
            fallback={<div className="notice">Flag disabled — turn on {FEATURE_FLAG_NAME} to reveal a premium call-to-action.</div>}
          >
            <div className="success-banner">
              <strong>{FEATURE_FLAG_NAME}</strong> is active. Customers now see premium upsell content.
            </div>
          </FeatureFlag>
        </div>
      </section>

      <section className="page-section">
        <h2 className="page-heading">What the demo showcases</h2>
        <p className="page-subheading">
          Each page mirrors the examples described in <code>docs/DEMO_APP_PLAN.md</code>. Use it as a living
          reference when wiring bridge into your own product.
        </p>
        <div className="feature-grid">
          <div className="feature-card">
            <h4>Authentication</h4>
            <p className="muted">Login, logout, protected routes, callback handling, and token auto-refresh.</p>
            <div className="chip-list">
              <span className="chip">Login component</span>
              <span className="chip">ProtectedRoute</span>
              <span className="chip">TokenStatus</span>
            </div>
          </div>
          <div className="feature-card">
            <h4>Feature flags</h4>
            <p className="muted">Cached vs live checks, negation, programmatic branching, and refresh flows.</p>
            <div className="chip-list">
              <span className="chip">FeatureFlag</span>
              <span className="chip">useFlag</span>
            </div>
          </div>
          <div className="feature-card">
            <h4>Team management</h4>
            <p className="muted">Native in-app team UI (no iframe) — users, profile, and workspace tabs.</p>
            <div className="chip-list">
              <span className="chip">TeamManagementPanel</span>
              <span className="chip">TeamService</span>
            </div>
          </div>
          <div className="feature-card">
            <h4>Subscriptions</h4>
            <p className="muted">In-app plan selection + Billing 2.0 drop-ins backed by auth-core.</p>
            <div className="chip-list">
              <span className="chip">PlanSelector</span>
              <span className="chip">useSubscription</span>
            </div>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="two-column">
          <div className="card">
            <h3>How to use this demo</h3>
            <div className="stat-row">
              <div>
                <div className="stat-label">1. Configure env vars</div>
                <div className="stat-value">Copy <code>.env.example</code></div>
              </div>
              <div>
                <div className="stat-label">2. Start bridge</div>
                <div className="stat-value">bun run dev</div>
              </div>
              <div>
                <div className="stat-label">3. Toggle flags</div>
                <div className="stat-value">Control Center → Feature flags</div>
              </div>
            </div>
          </div>
          <div className="card">
            <h3>Helpful links</h3>
            <div className="link-list">
              <a href="https://admin.nblocks.cloud" target="_blank" rel="noreferrer">
                bridge Control Center
              </a>
              <a href="https://github.com/nebulr-group/bridge" target="_blank" rel="noreferrer">
                bridge product documentation
              </a>
              <Link to="/feature-flags">Feature flag walkthrough</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default HomePage;


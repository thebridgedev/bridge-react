import { FeatureFlag, useAuth, useFeatureFlag } from '@nebulr-group/bridge-react';

const PRIMARY_FLAG = 'demo-flag';
const SECONDARY_FLAG = 'beta-dashboard';
const MAINTENANCE_FLAG = 'maintenance-mode';

function FeatureFlagDemo() {
  const { isAuthenticated } = useAuth();
  const premiumEnabled = useFeatureFlag(PRIMARY_FLAG);
  const betaDashboardEnabled = useFeatureFlag(SECONDARY_FLAG, { forceLive: true });
  const maintenanceMode = useFeatureFlag(MAINTENANCE_FLAG);

  return (
    <section className="page-section">
      <h2 className="page-heading">Feature Flag Patterns</h2>
      <p className="page-subheading">
        The examples below mirror the scenarios described in <code>docs/DEMO_APP_PLAN.md</code>. Toggle the corresponding
        flags in bridge to see the UI react instantly.
      </p>

      {!isAuthenticated && (
        <div className="notice">
          <strong>Login required:</strong> Feature flags are evaluated for the authenticated user. Sign in to see
          personalised evaluations.
        </div>
      )}

      <div className="grid-flag-examples">
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Cached evaluation</h3>
            <span className="badge">Flag: {PRIMARY_FLAG}</span>
          </div>
          <p className="muted">
            Uses the locally cached 5-minute window via <code>&lt;FeatureFlag /&gt;</code>.
          </p>
          <FeatureFlag
            flagName={PRIMARY_FLAG}
            fallback={<div className="notice">Enable <strong>{PRIMARY_FLAG}</strong> to reveal the premium widget.</div>}
          >
            <div className="success-banner">
              <strong>{PRIMARY_FLAG}</strong> is enabled. Showcasing premium-only UI here.
            </div>
          </FeatureFlag>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Live evaluation</h3>
            <span className="badge">Flag: {SECONDARY_FLAG}</span>
          </div>
          <p className="muted">
            Pass <code>forceLive</code> to bypass the cache when you need real-time decisions.
          </p>
          <FeatureFlag
            flagName={SECONDARY_FLAG}
            forceLive
            fallback={<div className="notice">Flip <strong>{SECONDARY_FLAG}</strong> on to preview the beta dashboard.</div>}
          >
            <div className="highlight-card">
              <h4>Beta dashboard is active</h4>
              <p>Render unreleased charts, opt-in flows, or experimental UI here.</p>
            </div>
          </FeatureFlag>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Programmatic usage</h3>
            <span className={`badge ${maintenanceMode ? 'badge-danger' : 'badge-success'}`}>
              {maintenanceMode ? 'Maintenance on' : 'Maintenance off'}
            </span>
          </div>
          <p className="muted">
            <code>useFeatureFlag</code> returns the boolean so you can branch imperatively.
          </p>
          {maintenanceMode ? (
            <div className="error-banner">
              Maintenance mode is enabled. Redirect traffic, pause writes, or show an outage banner.
            </div>
          ) : (
            <div className="success-banner">
              Maintenance mode is disabled. Customers get the normal experience.
            </div>
          )}
        </div>
      </div>

      <div className="page-section">
        <h3>Current evaluation snapshot</h3>
        <div className="status-grid">
          <div className="status-box">
            <div className="status-label">{PRIMARY_FLAG}</div>
            <div className="status-value">{premiumEnabled ? 'Enabled' : 'Disabled'}</div>
          </div>
          <div className="status-box">
            <div className="status-label">{SECONDARY_FLAG}</div>
            <div className="status-value">{betaDashboardEnabled ? 'Enabled (live)' : 'Disabled'}</div>
          </div>
          <div className="status-box">
            <div className="status-label">{MAINTENANCE_FLAG}</div>
            <div className="status-value">{maintenanceMode ? 'Enabled' : 'Disabled'}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default FeatureFlagDemo;


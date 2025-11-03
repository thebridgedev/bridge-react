import { TokenStatus, useAuth, useProfile } from '@nebulr-group/bridge-react';
import { Link } from 'react-router-dom';

function DashboardPage() {
  const { logout } = useAuth();
  const { profile, isLoading } = useProfile();

  return (
    <div className="page-section">
      <h1 className="page-heading">Welcome back</h1>
      <p className="page-subheading">
        This dashboard pulls data via <code>useProfile()</code> and reuses components showcased across the demo.
      </p>

      <section className="layout-split">
        <div className="card">
          <h3>Account summary</h3>
          <div className="stat-row">
            <div>
              <div className="stat-label">Full name</div>
              <div className="stat-value">{profile?.fullName ?? '—'}</div>
            </div>
            <div>
              <div className="stat-label">Email</div>
              <div className="stat-value">{profile?.email ?? '—'}</div>
            </div>
            <div>
              <div className="stat-label">Onboarded</div>
              <div className="stat-value">{profile?.onboarded ? 'Yes' : 'No'}</div>
            </div>
            {profile?.tenant && (
              <div>
                <div className="stat-label">Tenant</div>
                <div className="stat-value">{profile.tenant.name}</div>
              </div>
            )}
          </div>

          <div className="cta-actions" style={{ marginTop: '1.5rem' }}>
            <Link className="primary-button" to="/profile">
              View profile details
            </Link>
            <button type="button" className="secondary-button" onClick={logout}>
              Logout
            </button>
          </div>
        </div>

        <div className="card">
          <h3>Next steps</h3>
          <ul className="list">
            <li>
              {profile?.onboarded ? (
                <span>Invite teammates via the <Link to="/team">team management portal</Link>.</span>
              ) : (
                <span>Finish onboarding in bridge Control Center to personalise the experience.</span>
              )}
            </li>
            <li>
              Try toggling <code>demo-flag</code> or <code>beta-dashboard</code> to see feature flags in action.
            </li>
            <li>
              Explore the <Link to="/subscription">subscription page</Link> to jump into plan management.
            </li>
          </ul>
        </div>
      </section>

      <section className="page-section">
        <h2 className="page-heading">Token health</h2>
        <p className="muted">
          The <code>&lt;TokenStatus /&gt;</code> component gives a live view of expiry timing and manual refresh controls.
        </p>
        <div className="token-status-wrapper">
          {isLoading ? (
            <div className="loading-banner">Fetching profile…</div>
          ) : (
            <TokenStatus />
          )}
        </div>
      </section>
    </div>
  );
}

export default DashboardPage;


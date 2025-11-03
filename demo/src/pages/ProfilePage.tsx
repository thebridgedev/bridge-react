import { useProfile } from '@nebulr-group/bridge-react';

function ProfilePage() {
  const { profile, isLoading, error, updateProfile } = useProfile();

  return (
    <div className="page-section">
      <h1 className="page-heading">Profile</h1>
      <p className="page-subheading">
        Powered by <code>useProfile()</code>. Data is derived from the ID token and refreshed on demand.
      </p>

      {isLoading && <div className="loading-banner">Loading profile data…</div>}
      {error && <div className="error-banner">{error}</div>}

      <div className="profile-grid">
        <div className="profile-card">
          <h3>User</h3>
          <div className="profile-details">
            <span>Email</span>
            <strong>{profile?.email ?? '—'}</strong>
            <span>Username</span>
            <strong>{profile?.username ?? '—'}</strong>
            <span>Full name</span>
            <strong>{profile?.fullName ?? '—'}</strong>
            <span>Email verified</span>
            <strong>{profile?.emailVerified ? 'Yes' : 'No'}</strong>
            <span>Locale</span>
            <strong>{profile?.locale ?? '—'}</strong>
            <span>Onboarded</span>
            <strong>{profile?.onboarded ? 'Yes' : 'No'}</strong>
            <span>Multi-tenant access</span>
            <strong>{profile?.multiTenantAccess ? 'Yes' : 'No'}</strong>
          </div>
        </div>

        <div className="profile-card">
          <h3>Tenant</h3>
          {profile?.tenant ? (
            <div className="profile-details">
              <span>Name</span>
              <strong>{profile.tenant.name}</strong>
              <span>ID</span>
              <strong>{profile.tenant.id}</strong>
              <span>Locale</span>
              <strong>{profile.tenant.locale ?? '—'}</strong>
              <span>Onboarded</span>
              <strong>{profile.tenant.onboarded ? 'Yes' : 'No'}</strong>
            </div>
          ) : (
            <div className="notice">No tenant assigned to this profile yet.</div>
          )}
        </div>
      </div>

      <section className="page-section">
        <div className="card">
          <h3>Refresh profile</h3>
          <p className="muted">
            This calls <code>await updateProfile()</code>, which in turn re-validates the ID token and updates the
            Zustand store.
          </p>
          <button type="button" className="secondary-button" onClick={updateProfile} disabled={isLoading}>
            {isLoading ? 'Refreshing…' : 'Refresh now'}
          </button>
        </div>
      </section>
    </div>
  );
}

export default ProfilePage;


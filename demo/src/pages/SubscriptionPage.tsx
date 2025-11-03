import { Subscription } from '@nebulr-group/bridge-react';

function SubscriptionPage() {
  return (
    <div className="page-section">
      <h1 className="page-heading">Subscription management</h1>
      <p className="page-subheading">
        Redirects authenticated users to the bridge-hosted plan selection experience. Useful for billing portals and
        add-on upgrades.
      </p>

      <div className="card">
        <h3>What happens here?</h3>
        <p className="muted">
          The component initialises the team management service, exchanges the current access token for a handover code,
          and performs a full-page redirect. If anything fails the user sees an inline error message.
        </p>
      </div>

      <Subscription />
    </div>
  );
}

export default SubscriptionPage;


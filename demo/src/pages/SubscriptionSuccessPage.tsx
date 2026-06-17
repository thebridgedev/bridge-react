import { loadSubscription } from '@nebulr-group/bridge-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';

function SubscriptionSuccessPage() {
  useEffect(() => {
    // Re-fetch so the UI reflects the new plan immediately after returning from Stripe.
    void loadSubscription();
  }, []);
  return (
    <div className="page-section">
      <h1 className="page-heading">Subscription active</h1>
      <p className="page-subheading">Thanks — your subscription is now active.</p>
      <Link to="/" className="nav-link">
        Back to home
      </Link>
    </div>
  );
}

export default SubscriptionSuccessPage;

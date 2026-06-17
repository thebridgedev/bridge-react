// Test harness route for the startCheckout URL normalization regression.
// PlanSelector is intentionally given relative paths so the e2e test can assert
// that auth-core resolves them to absolute URLs before hitting the
// /account/subscription/checkout endpoint.
// Regression: stripe.service.ts rejected relative success_url/cancel_url with
// 400 "Not a valid URL". Fix lives in auth-core bridge-auth.ts. (2026-04-15)

import { PlanSelector, loadSubscription } from '@nebulr-group/bridge-react';
import { useEffect } from 'react';

function SubscriptionRelativePage() {
  useEffect(() => {
    void loadSubscription();
  }, []);

  return (
    <div className="page-section">
      <h1 className="page-heading">Subscription Plans (relative URL harness)</h1>
      <PlanSelector successRedirect="/plan" cancelRedirect="/plan" />
    </div>
  );
}

export default SubscriptionRelativePage;

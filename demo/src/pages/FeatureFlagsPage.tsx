import FeatureFlagDemo from '../components/FeatureFlagDemo';

function FeatureFlagsPage() {
  return (
    <div className="page-section">
      <h1 className="page-heading">Feature flag cookbook</h1>
      <p className="page-subheading">
        Mirrors the walkthrough in <code>docs/DEMO_APP_PLAN.md</code>. Use this page to validate your flags before
        rolling them into production.
      </p>

      <FeatureFlagDemo />

      <section className="page-section">
        <div className="card">
          <h3>Flag management tips</h3>
          <ul className="list">
            <li>Group related flags under prefixes (for example <code>demo-*</code> vs <code>beta-*</code>).</li>
            <li>
              Enforce expirations. Once a feature is fully rolled out, remove the flag from code and Control Center.
            </li>
            <li>
              Combine with <code>ProtectedRoute</code> to hide entire routes, or use <code>Subscription</code> to gate
              premium journeys.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}

export default FeatureFlagsPage;


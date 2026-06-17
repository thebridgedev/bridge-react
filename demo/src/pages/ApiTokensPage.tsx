import { ApiTokenManagement } from '@nebulr-group/bridge-react';

function ApiTokensPage() {
  return (
    <div className="page-section">
      <h1 className="page-heading">API Tokens</h1>
      <p className="page-subheading">
        Powered by <code>&lt;ApiTokenManagement /&gt;</code>. Create, list, and
        revoke long-lived JWT tokens for programmatic API access.
      </p>

      <div className="card">
        <ApiTokenManagement />
      </div>
    </div>
  );
}

export default ApiTokensPage;

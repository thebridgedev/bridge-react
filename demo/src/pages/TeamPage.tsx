import { TeamManagementPanel } from '@nebulr-group/bridge-react';

function TeamPage() {
  return (
    <div className="page-section">
      <h1 className="page-heading">Team management</h1>
      <p className="page-subheading">
        The <code>&lt;TeamManagementPanel /&gt;</code> component renders team UI natively in-app
        (no iframe, direct GraphQL via auth-core's <code>TeamService</code>).
      </p>

      <div className="card">
        <h3>Usage tips</h3>
        <ul className="list">
          <li>Tokens must be present in storage — log in first.</li>
          <li>
            Use the <code>tabBar</code> render prop to fully customize the tab navigation.
          </li>
          <li>
            See <code>/team-panel</code> for a custom-tabbed example and <code>/workspaces</code> for
            workspace switching.
          </li>
        </ul>
      </div>

      <div className="team-container">
        <TeamManagementPanel onError={(err) => console.error('[Team]', err)} />
      </div>
    </div>
  );
}

export default TeamPage;

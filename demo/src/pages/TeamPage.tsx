import { Team } from '@nebulr-group/bridge-react';

function TeamPage() {
  return (
    <div className="page-section">
      <h1 className="page-heading">Team management</h1>
      <p className="page-subheading">
        The <code>&lt;Team /&gt;</code> component embeds the hosted portal. We wrap it in a responsive container so it
        fills the viewport.
      </p>

      <div className="card">
        <h3>Usage tips</h3>
        <ul className="list">
          <li>Tokens must be present in storage — log in first.</li>
          <li>
            If you prefer a new window, call <code>TeamManagementService.launchTeamManagement()</code> instead.
          </li>
          <li>Set <code>VITE_BRIDGE_TEAM_MANAGEMENT_URL</code> to override the default portal.</li>
        </ul>
      </div>

      <div className="team-container">
        <Team />
      </div>
    </div>
  );
}

export default TeamPage;


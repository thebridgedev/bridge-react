import { TeamManagementPanel } from '@nebulr-group/bridge-react';

/**
 * Mirrors bridge-svelte's `routes/team-panel/+page.svelte` and bridge-nextjs's
 * `app/team-panel/page.tsx`:
 *   - Renders the native TeamManagementPanel (no iframe, direct GraphQL).
 *   - Provides a custom `tabBar` using `.my-tabs` / `.my-tab` classes to
 *     demonstrate the render-prop API. The e2e spec targets these classes.
 *
 * Route protection is handled by the parent <ProtectedRoute> in App.tsx.
 */
function TeamPanelPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ marginBottom: '0.5rem', color: '#1f2937' }}>
        Team Management (Native SDK)
      </h1>
      <p style={{ marginBottom: '2rem', color: '#6b7280', fontSize: '0.875rem' }}>
        This uses the native <code>TeamManagementPanel</code> component — no iframe, direct GraphQL.
      </p>
      <TeamManagementPanel
        onError={(err) => console.error('[TeamPanel]', err)}
        tabBar={({ tabs, activeTab, setTab }) => (
          <nav className="my-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`my-tab${activeTab === tab.id ? ' my-tab--active' : ''}`}
                onClick={() => setTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}
      />
    </div>
  );
}

export default TeamPanelPage;

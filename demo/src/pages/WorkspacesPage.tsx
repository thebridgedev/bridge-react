import { WorkspaceSelector } from '@nebulr-group/bridge-react';

/**
 * Mirrors bridge-svelte's `routes/workspaces` and bridge-nextjs's
 * `app/workspaces/page.tsx`. Lets the user switch between workspaces they have
 * access to. Route protection is handled by the parent <ProtectedRoute>.
 */
function WorkspacesPage() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Workspaces</h1>
      <p>Switch between workspaces you have access to.</p>
      <WorkspaceSelector
        onSwitch={() => {
          // Full reload so all hooks reset to the new workspace's context.
          window.location.reload();
        }}
        onError={(err) => console.error('[Workspaces]', err)}
      />
    </div>
  );
}

export default WorkspacesPage;

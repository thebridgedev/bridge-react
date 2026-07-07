# Switching workspaces

## WorkspaceSelector

A drop-in switcher that lists the workspaces the signed-in user can access and switches the active one. On switch, the SDK re-issues a session for the chosen tenant and the whole `bridge` surface re-snapshots.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onSwitch` | `() => void` | — | Called after the active workspace changes |
| `onError` | `(error: Error) => void` | — | Called on switch error |
| `workspaceItem` | `(ctx: { workspace: Workspace; isActive: boolean; isLoading: boolean; onSelect: () => void }) => ReactNode` | — | Custom render function per workspace row |

**Usage:**

```tsx
import { WorkspaceSelector } from '@nebulr-group/bridge-react';
import { useNavigate } from 'react-router-dom';

function WorkspaceSettingsPage() {
  const navigate = useNavigate();

  return (
    <WorkspaceSelector
      onSwitch={() => navigate('/')}
      onError={(err) => console.error(err)}
    />
  );
}
```

**Custom row markup** — supply a `workspaceItem` render function for full control:

```tsx
import { WorkspaceSelector } from '@nebulr-group/bridge-react';

<WorkspaceSelector
  workspaceItem={({ workspace, isActive, isLoading, onSelect }) => (
    <button className={isActive ? 'active' : ''} disabled={isLoading} onClick={onSelect}>
      {workspace.tenant.name}
      {isActive ? ' ✓' : ''}
    </button>
  )}
/>
```

## TenantSelector at login

When a user's credentials map to more than one tenant, `LoginForm` surfaces a `TenantSelector` step automatically so they pick which workspace to enter. You don't wire anything — it appears when `authState` becomes `'tenant-selection'`. See [Auth states](/auth/user-token/auth-states/) for the full list of states.

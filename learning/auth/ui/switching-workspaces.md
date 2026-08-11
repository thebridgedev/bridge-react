# Switching workspaces

Two components cover workspace selection (a workspace is called a *tenant* in the API, which is why some identifiers below say `tenant`):

- **`TenantSelector`**: part of the login flow. Lets a user pick which workspace to sign in to.
- **`WorkspaceSelector`**: for an already signed-in user. Lets them switch the active workspace, for example from a settings page or sidebar.

Both only come into play when the user has **more than one enabled membership in an active tenant**. A membership that's been disabled, or a workspace that isn't active (for example, suspended for non-payment), doesn't count and won't be shown. A user with exactly one enabled-and-active membership goes straight in with no selector.

## TenantSelector

Lets a user with multiple workspaces pick one during login. It appears automatically inside `LoginForm` when `authState` becomes `'tenant-selection'` (see [Auth states](/auth/user-token/auth-states/)), so you normally don't wire anything. Use it standalone only if you're building a custom login flow.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onSelect` | `() => void` | (none) | Called after a workspace is selected |
| `onError` | `(error: Error) => void` | (none) | Called on error |
| `tenantItem` | `(tenantUser: TenantUser) => ReactNode` | (none) | Custom render prop for each workspace item |

**Standalone usage with a custom item:**

```tsx
import { TenantSelector, useAuth } from '@nebulr-group/bridge-react';
import { useNavigate } from 'react-router-dom';

function WorkspaceStep() {
  const { authState } = useAuth();
  const navigate = useNavigate();

  if (authState !== 'tenant-selection') return null;
  return (
    <TenantSelector
      onSelect={() => navigate('/dashboard')}
      tenantItem={(tenantUser) => (
        <div className="tenant-card">
          <strong>{tenantUser.tenant.name}</strong>
          <span>{tenantUser.username}</span>
        </div>
      )}
    />
  );
}
```

## WorkspaceSelector

A drop-in switcher that lists the workspaces the signed-in user can access and switches the active one. On switch, the SDK issues a fresh session for the chosen workspace and refreshes the whole `bridge` object in one update, including the user's role, which may differ in the new workspace.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onSwitch` | `() => void` | (none) | Called after the active workspace changes |
| `onError` | `(error: Error) => void` | (none) | Called on switch error |
| `workspaceItem` | `({ workspace, isActive, isLoading, onSelect }) => ReactNode` | (none) | Custom render prop per workspace row |

**Usage:**

```tsx
import { WorkspaceSelector } from '@nebulr-group/bridge-react';
import { useNavigate } from 'react-router-dom';

function WorkspaceSwitcher() {
  const navigate = useNavigate();

  return (
    <WorkspaceSelector
      onSwitch={() => navigate('/')}
      onError={(err) => console.error(err)}
    />
  );
}
```

**Custom row markup**: supply a `workspaceItem` render prop for full control. The `workspace` object carries the workspace's details under `workspace.tenant` (`id`, `name`, `logo`), plus the membership's `id`, `username`, and `fullName`:

```tsx
<WorkspaceSelector
  workspaceItem={({ workspace, isActive, isLoading, onSelect }) => (
    <button
      className={isActive ? 'active' : ''}
      disabled={isLoading}
      onClick={onSelect}
    >
      {workspace.tenant.name}{isActive ? ' ✓' : ''}
    </button>
  )}
/>
```

For the concept behind all of this (what a workspace is, how isolation works), see [Multi-tenancy](/auth/multi-tenancy/).

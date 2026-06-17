# Team Management

The SDK team panel renders directly inside your app — no redirect to a separate portal.

## Minimum integration

```tsx
import { TeamManagementPanel } from '@nebulr-group/bridge-react';

export default function TeamPage() {
  return <TeamManagementPanel />;
}
```

That single component handles:
- **Users tab** — list, add (`<TeamAddUserDialog>`), edit role/enabled (`<TeamEditUserDialog>`), reset password, delete.
- **Profile tab** — `<TeamProfileForm>` for the current user.
- **Workspace tab** — `<TeamWorkspaceForm>` for tenant-wide settings.

## Toggling tabs

```tsx
<TeamManagementPanel
  defaultTab="profile"
  showWorkspaceTab={false}
/>
```

## Using sub-components directly

```tsx
import {
  TeamUserList,
  TeamProfileForm,
  TeamWorkspaceForm,
} from '@nebulr-group/bridge-react';

export default function CustomTeamLayout() {
  return (
    <div className="grid grid-cols-2 gap-8">
      <TeamUserList />
      <div>
        <TeamProfileForm />
        <TeamWorkspaceForm />
      </div>
    </div>
  );
}
```

## Custom tab bar

```tsx
<TeamManagementPanel
  tabBar={({ tabs, activeTab, setTab }) => (
    /* render your own tabs UI */
  )}
/>
```

## Error handling

```tsx
<TeamManagementPanel onError={(err) => analytics.track('team_error', { err })} />
```

## Auth-core methods used

Internally calls `getBridgeAuth().team.*`:
- `listUsers()`, `listUserRoles()`
- `createUsers(emails)`
- `updateUser({ id, role, enabled })`
- `deleteUser(id)`
- `sendPasswordResetLink(id)`
- `getProfile()`, `updateProfile({ firstName, lastName })`
- `getWorkspace()`, `updateWorkspace({ name, locale })`

You can also import `TeamService` from `@nebulr-group/bridge-react` if you build a fully
custom UI. Use any of these directly when you do.

## Common pitfalls

- **Empty user list:** the user must be authenticated AND have permission to list team members (usually `admin` role).
- **Add-user dialog accepts comma- or newline-separated emails.** Anything else fails validation.
- **Updates to the workspace** require admin privileges. Non-admins see the workspace tab but get a permission error on save.

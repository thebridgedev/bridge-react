# User & team management

## TeamManagementPanel

A drop-in panel for managing team members, team profile, and workspace settings. Renders three tabs: **Users**, **Profile**, and **Workspace**.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `defaultTab` | `'users' \| 'profile' \| 'workspace'` | `'users'` | Which tab is active by default |
| `showProfileTab` | `boolean` | `true` | Show the profile tab |
| `showWorkspaceTab` | `boolean` | `true` | Show the workspace tab |
| `onError` | `(error: Error) => void` | (none) | Called on any error |
| `seatsMetric` | `string` | (none) | The plan limit that counts seats (e.g. `'seats'`). With it, inviting stops at the plan's limit |
| `tabBar` | `({ tabs, activeTab, setTab }) => ReactNode` | (none) | Custom tab bar render prop |

**Usage:**

```tsx
// src/pages/TeamPage.tsx (rendered at /settings/team)
import { TeamManagementPanel } from '@nebulr-group/bridge-react';

function TeamPage() {
  return (
    <TeamManagementPanel
      defaultTab="users"
      onError={(err) => console.error(err)}
    />
  );
}
```

**Custom tab bar:**

```tsx
<TeamManagementPanel
  tabBar={({ tabs, activeTab, setTab }) => (
    <nav className="custom-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={activeTab === tab.id ? 'active' : ''}
          onClick={() => setTab(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )}
/>
```

The panel includes:
- **Users tab**: list team members, invite new users, update roles, remove members.
- **Profile tab**: update team name and other profile fields.
- **Workspace tab**: update workspace settings.

## Individual tab components

Each tab is also exported as a standalone component. Use these when you only need one piece of team management, or want to build your own layout:

```tsx
import { TeamProfileForm, TeamUserList, TeamWorkspaceForm } from '@nebulr-group/bridge-react';

// Just the user list
<TeamUserList onError={(err) => console.error(err)} />

// Just the profile form
<TeamProfileForm onError={(err) => console.error(err)} />

// Just the workspace settings
<TeamWorkspaceForm onError={(err) => console.error(err)} />
```

All three accept `className`, `style`, and `onError` props.

## Seat limits

Seats are a plan limit you name, counted by Bridge from membership (active members plus pending invites):

```bash
bridge plan quota set <plan> --metric seats --limit N --policy hard --kind gauge --source membership
```

Pass the metric name to the team page and it enforces the limit: **Add Member** is disabled at the plan's limit with a line saying why and an upgrade link (`billing.manageRoute`, default `/billing`), an invite of more addresses than seats left is refused before anything is sent, and the seat count is re-read after an invite, a removal or an enable/disable.

```tsx
<TeamManagementPanel seatsMetric="seats" />
// or
<TeamUserList seatsMetric="seats" />
```

Without `seatsMetric` the page reads no quota and never gates. A metered seat limit (extra seats billed) is never refused here.

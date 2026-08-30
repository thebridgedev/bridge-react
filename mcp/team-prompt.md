# Bridge React — Team Management

You are adding team management to a React application that uses The Bridge.

## Decide first — how much do you want to build?

| You want | Use | Effort |
|---|---|---|
| A complete team settings page | `<TeamManagementPanel>` | One component |
| Only the member list | `<TeamUserList>` | One component |
| Only the workspace/profile forms | `<TeamProfileForm>`, `<TeamWorkspaceForm>` | One component each |
| Your own layout, Bridge's dialogs | The individual pieces below | Moderate |
| Your own everything | Bridge management API from your backend | Do not — see below |

**Start at the top of this table and only move down when a requirement forces you to.** The panel already handles invite, role change, removal, confirmation dialogs, loading and error states, and it stays correct as the platform's role model changes.

> **Do not build a team CRUD API in your own backend and proxy to it.** The components talk to Bridge directly with the signed-in user's token, and Bridge enforces who may do what. A proxy adds a hop, a second place for role logic to drift, and a new way to leak another workspace's members. The backend plugins (`bridge-nestjs`, `bridge-express`) deliberately expose no team CRUD for this reason.

## Prerequisites

1. `@nebulr-group/bridge-react` installed.
2. `<BridgeProvider>` mounted above the router (see `integration-prompt.md`).
3. `import '@nebulr-group/bridge-react/styles'` — without it the panel renders unstyled.
4. The route is behind auth: team management needs a signed-in user.

## The whole panel

```tsx
// src/pages/TeamSettingsPage.tsx
import { TeamManagementPanel } from '@nebulr-group/bridge-react';

export default function TeamSettingsPage() {
  return (
    <div>
      <h1>Team settings</h1>
      <TeamManagementPanel defaultTab="users" onError={(err) => console.error(err)} />
    </div>
  );
}
```

Three tabs: **Users** (list, invite, re-role, remove), **Profile**, **Workspace**.

| Prop | Type | Default | Description |
|---|---|---|---|
| `defaultTab` | `'users' \| 'profile' \| 'workspace'` | `'users'` | Initially active tab |
| `showProfileTab` | `boolean` | `true` | Show the profile tab |
| `showWorkspaceTab` | `boolean` | `true` | Show the workspace tab |
| `onError` | `(error: Error) => void` | — | Called on any error |
| `tabBar` | `(ctx) => ReactNode` | — | Custom tab bar renderer |

It also accepts the usual `div` attributes, so `className` works for layout.

### A custom tab bar

Restyle the tabs without giving up the panel:

```tsx
<TeamManagementPanel
  tabBar={({ tabs, activeTab, setTab }) => (
    <nav className="my-tabs">
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

## The individual pieces

Use these when the panel's layout genuinely does not fit. They are the same components the panel composes:

| Component | Purpose |
|---|---|
| `<TeamUserList>` | Member list with row actions |
| `<TeamAddUserDialog>` | Invite a member |
| `<TeamEditUserDialog>` | Change a member's role |
| `<TeamConfirmDialog>` | Confirmation for destructive actions |
| `<TeamUserActionsMenu>` | Per-row action menu |
| `<TeamProfileForm>` | Current user's profile |
| `<TeamWorkspaceForm>` | Workspace settings |

## Who is allowed to do what

Bridge enforces this server-side from the caller's role and privileges — the components surface it, they do not decide it. `OWNER` and `ADMIN` can manage members; a plain member cannot.

> **Hiding a button is not a permission check.** If you conditionally render an action on the client, do it for UX only. The boundary is the server's check against the verified token, and it is already there.

To change what a role may do, edit the role's privileges over MCP (`update_role`) or the CLI (`bridge role update`) — not in app code.

## Managing members outside the UI

Scripts, seeding, migrations:

| Task | MCP | CLI |
|---|---|---|
| List workspaces | `list_tenants` | `bridge tenant list` |
| Create a workspace | `create_tenant` | `bridge tenant create` |
| Add a member | `create_tenant_user` | `bridge user invite` |
| Change a role | `update_tenant_user` | `bridge user update` |
| Remove a member | `delete_tenant_user` | `bridge user delete` |

Deletions need a token carrying the matching destructive privilege. A default `bridge auth login` token has none by design — `bridge auth login --admin` requests them.

## Common mistakes

- **Rebuilding the member list from your own API.** The components already talk to Bridge; a copy in your database goes stale the moment someone is removed.
- **Forgetting the stylesheet import** — the panel looks broken rather than unstyled.
- **Rendering it on a public route.** It needs an authenticated user; without one it errors rather than showing an empty state.
- **Assuming "team" means one fixed workspace.** A user can belong to several; the panel operates on the currently selected one.

## Related guides

- `integration-prompt.md` — provider and router setup
- `sdk-auth-prompt.md` — login, signup, workspace selection
- `billing-prompt.md` — plans and quotas, which are per-workspace

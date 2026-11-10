# Bridge React — Team Management

You are adding team management to a React application that uses The Bridge.

## The one rule for app code

**Every gate in app code is a flag.** A link, a page, a button, an endpoint: if some people get it and others do not, the code asks a flag, and the flag's rule says why: a privilege (`privileges contains "USER_WRITE"`), a plan feature (`bridge:billing.entitlement.analytics eq true`) or a rollout. App code never reads a role, a privilege list, the plan or a plan feature to decide what someone may see or do.

Two things are not gates and are not flags: **numbers** are plan limits (`<QuotaGate>` in the browser, `@RequireQuota` on the backend), and **permission on one specific record** stays in app code ("only the author edits their post").

Before calling the work done, run `npx @nebulr-group/bridge-cli check gates` in the project. It lists every direct role, privilege, plan or plan-feature check with the flag to use instead. Fix each one.

In React: a piece of UI is `<FeatureFlag flagKey="…">`; a page is a guard component built on `useFlag` (see *Route setup* below); a nav link is the same `<FeatureFlag>` around the link.

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
| `seatsMetric` | `string` | — | The plan limit that counts seats, e.g. `"seats"`. With it, Invite stops at the plan's limit and says why. See **Seat limits** below |
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
| `<TeamUserList>` | Member list with row actions; takes `seatsMetric` too |
| `<TeamAddUserDialog>` | Invite a member |
| `<TeamEditUserDialog>` | Change a member's role |
| `<TeamConfirmDialog>` | Confirmation for destructive actions |
| `<TeamUserActionsMenu>` | Per-row action menu |
| `<TeamProfileForm>` | Current user's profile |
| `<TeamWorkspaceForm>` | Workspace settings |

## Seat limits — when a plan sells seats

Seats are a plan limit the app names, `seats` here, like any other limit. It is a gauge that Bridge counts from workspace membership: the active members plus pending invites, read fresh however members are added or removed. There is no built-in `users` metric and no seat logic in Bridge. A seat count is a number, so it is a plan limit; never gate seats with a flag or an entitlement.

1. **Put the limit on each plan**, counted from membership:

```bash
bridge plan quota set <plan> --metric seats --limit N --policy hard --kind gauge --source membership
```

For "2 seats on Free, 5 on Pro": `bridge plan quota set free --metric seats --limit 2 --policy hard --kind gauge --source membership`, then the same for `pro` with `--limit 5`. (MCP: `set_plan_quota` with `metric: "seats"`, `policy: "hard"`, `kind: "gauge"`, `source: "membership"`.)

2. **Ask the user where invites start**: Bridge's built-in team page, or the app's own invite handler? Each answer is one line:
   - **Built-in team page**: `<TeamManagementPanel seatsMetric="seats" />` (or `<TeamUserList seatsMetric="seats" />`). Invite stops at the plan's limit and the line under it explains why, with the upgrade link. The count is re-read after every invite, removal, enable or disable.
   - **The app's own invite handler**: `@RequireQuota('seats')` on that backend handler. It checks the seat limit and writes nothing, because Bridge counts the members.

3. **Bridge's invite API does not refuse at the limit.** The check runs where the invite starts, which is why step 2 matters. Without `seatsMetric` the team page invites past the limit.

## Route setup — who sees the team page

Not everyone in a workspace should manage its members, so the team page and its nav link are gated. Like every gate in app code, that gate is a flag ruled on a privilege — never a role list in the code such as `['OWNER','ADMIN'].includes(role)`.

1. **Read the app's real roles first**: `list_roles` (MCP) or `bridge role list` (CLI). What a role can do is only "in the default setup"; pick the privilege the roles that should manage members actually hold (in the default setup, `USER_WRITE`).
2. **Create the flag** `team-management`, ruled on that privilege:

```bash
bridge flag create --key team-management --value-type boolean --state on-with-rule \
  --rule '{"branches":[{"conditions":[{"attribute":"privileges","operator":"contains","values":["USER_WRITE"]}],"returnValue":true}],"otherwiseValue":false,"rolloutPct":100}'
```

(MCP: `create_feature_flag` with the same rule as a structured object.) `contains` on `privileges` is exact membership.

3. **Gate the route** with a guard component built on `useFlag`, inside `<ProtectedRoute>` so a signed-out visitor is sent to the login first:

```tsx
import { ProtectedRoute, useFlag } from '@nebulr-group/bridge-react';
import { Navigate, Route } from 'react-router-dom';

function FlagRoute({ flag, children }: { flag: string; children: React.ReactNode }) {
  const { value } = useFlag(flag, false);
  return value ? <>{children}</> : <Navigate to="/" replace />;
}

<Route
  path="/settings/team"
  element={
    <ProtectedRoute>
      <FlagRoute flag="team-management">
        <TeamSettingsPage />
      </FlagRoute>
    </ProtectedRoute>
  }
/>
```

4. **Gate the nav link** with the same flag:

```tsx
import { FeatureFlag } from '@nebulr-group/bridge-react';

<FeatureFlag flagKey="team-management" defaultValue={false}>
  <a href="/settings/team">Team settings</a>
</FeatureFlag>
```

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

## Verify

1. Signed in with a role that holds the privilege, open `/settings/team` — the panel renders and the nav link shows; with a role that does not, the link is hidden and the route redirects to `/`.
2. The **Users** tab lists the current members; invite someone from it.
3. If the plans sell seats and the page has `seatsMetric="seats"`: on a plan with 2 seats and 2 members, Invite is disabled and says all seats are taken.
4. Run the project's build command — no TypeScript or import errors.
5. Run `npx @nebulr-group/bridge-cli check gates` — it reports nothing.

## Related guides

- `integration-prompt.md` — provider and router setup
- `sdk-auth-prompt.md` — login, signup, workspace selection
- `billing-prompt.md` — plans and quotas, which are per-workspace

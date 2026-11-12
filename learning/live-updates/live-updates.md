# Live updates

Bridge tells the page within about a second when something it shows has changed: a flag's rule, the team, the workspace, the plan. The plugin fetches it again, so screens stay current without a reload. It is on by default; `live: false` in the config turns it off.

## What refreshes by itself

- **Flag results**, and with them `<FeatureFlag>`, `useFlag` and the route guard: a page whose flag was turned off closes.
- **The workspace list and profile** (`useWorkspaces()`, `useMe()`).
- **Billing facts and plans** (`useBilling()`, `usePlans()`, `useUsage()`), after a checkout, a plan change or a renewal.
- **The team panel**, when a member joins, changes or leaves.
- **The session**: a session ended from another device is noticed at once.

A notice never carries the data itself, only what changed. The page reads the data through the API, which checks who is asking.

## Your own screens

```tsx
import { getBridge } from '@nebulr-group/bridge-react';

useEffect(() => getBridge().live.on('accounts.member_updated', () => reloadMyList()), []);
```

`live.on('*', …)` receives every notice. `bridge.live.many_changed` means several things changed or some notices were missed: fetch what you show again.

For your own data, `resource(load, notices)` and `useResource` do this for you:

```tsx
import { resource, useResource } from '@nebulr-group/bridge-react';

// Once, at module level.
const projects = resource((bridge) => bridge.fetch('/api/projects').then((r) => r.json()), ['accounts.']);

export function Projects() {
  const { value, loading, error, refresh } = useResource(projects);
  // …
}
```

It fetches when first shown, again when the person or workspace changes, and again on a matching notice.

## The connection

`useLiveStatus()` is `open`, `polling` (no socket; it checks every few seconds instead), `connecting`, `closed` or `off`. `<LiveStatusBadge />` shows it, for development builds.

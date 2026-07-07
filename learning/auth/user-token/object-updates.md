---
title: How the user token is updated
description: How role, plan, and permission changes reach your app live, and what happens offline.
sidebar:
  label: React
---

# How the user token is updated

Once `<BridgeProvider>` connects, your app is subscribed to a live channel for as long as it's open. When an admin changes something about the signed-in user server-side — their role, their workspace's plan, a permission — Bridge pushes that change down the channel and refreshes the session automatically. The reactive `bridge` surface updates in place. There's no reload, no polling, and nothing to wire up beyond reading `bridge.user` through `useBridgeReadable`.

## Example: a role change reaching your UI live

```tsx
import { bridge, useBridgeReadable } from '@nebulr-group/bridge-react';

function AdminGate() {
  const user = useBridgeReadable(bridge.user);

  if (user?.role === 'admin') return <AdminPanel />;
  return <p>You don't have access to this area.</p>;
}
```

If an admin changes this user's role from `member` to `admin` in the Control Center, `user.role` updates on its own and `<AdminPanel />` appears — no refresh, because `useBridgeReadable` re-renders the component whenever `bridge.user` changes rather than reading a snapshot captured once on mount. Structure your gated UI this way (read the live value through the hook, not a value you captured earlier) and it stays correct automatically.

## Reacting to the exact moment something changes

For a side effect at the moment of change — a toast, an analytics event, an audit log — subscribe on the unified events dispatcher:

```tsx
import { useEffect } from 'react';
import { bridge } from '@nebulr-group/bridge-react';

function useAuditToasts() {
  useEffect(() => {
    return bridge.events.handle({
      'user.state_changed': (msg) => toast(`Your access changed: ${msg.reason}`),
      'session.snapshot': (msg) => console.log('Session refreshed', msg.data),
    });
  }, []);
}
```

`bridge.events.handle({...})` returns an unsubscribe function — call it (or return it straight from `useEffect`, as above) to clean up when the component unmounts.

## What happens while your app is offline

If the live channel drops (network blip, laptop sleep, server restart), the `bridge` surface **freezes at its last-known values** — nothing clears, nothing errors. Bridge doesn't have anything new to tell you, so it doesn't tell you anything.

When the channel reconnects, two things happen automatically:

1. Bridge proactively refreshes your tokens, in case a role/plan change was broadcast while you were disconnected and missed.
2. The server sends a fresh session snapshot, which atomically overwrites every slice (`bridge.user`, `bridge.tenant`, subscription, entitlements) in one update — so you're back in sync even if several things changed while you were offline.

You can watch the connection itself if you want to show an offline indicator:

```tsx
import { useRealtimeStatus } from '@nebulr-group/bridge-react';
// returns 'idle' | 'connecting' | 'open' | 'closed'

function ConnectionBadge() {
  const status = useRealtimeStatus();
  if (status !== 'open') return <p>Reconnecting…</p>;
  return null;
}
```

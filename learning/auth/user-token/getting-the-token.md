---
title: Getting the user token
description: Read the signed-in user's identity, the recommended way and the alternatives.
sidebar:
  label: React
---

# Getting the user token

The user's token is set the moment they sign in — through `LoginForm`, `SsoButton`, a passkey, magic link, or however your app authenticates them — and Bridge keeps it valid from then on. You never fetch or store it yourself.

## The recommended path: the unified `bridge` surface

For almost everything you build, read the signed-in user from `bridge.user` via `useBridgeReadable` — it's live, reactive, and requires no setup beyond wrapping your app in `<BridgeProvider>`:

```tsx
import { bridge, useBridgeReadable } from '@nebulr-group/bridge-react';

function UserBadge() {
  const user = useBridgeReadable(bridge.user);

  if (!user) return null;
  return <p>{user.email} — {user.role}</p>;
}
```

`bridge.user` exposes:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | The user's unique identifier |
| `email` | `string \| undefined` | The user's email |
| `role` | `string` | The user's role within the current tenant |
| `tenantId` | `string` | The current workspace's ID |

It's populated from the live channel's session snapshot on connect and every reconnect, so it's always current — see [How the user token is updated](/auth/user-token/object-updates/).

## Richer profile fields: `useProfile()`

`bridge.user` is intentionally minimal. For display fields like full name, avatar-worthy details, or tenant name/logo, use the `useProfile()` hook:

```tsx
import { useProfile } from '@nebulr-group/bridge-react';

function ProfileCard() {
  const { profile } = useProfile();

  if (!profile) return null;
  return (
    <>
      <h2>{profile.fullName}</h2>
      <p>{profile.email}</p>
    </>
  );
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | The user's unique identifier |
| `username` | `string` | Username |
| `email` | `string` | Email |
| `emailVerified` | `boolean` | Email verification status |
| `fullName` | `string` | Full display name |
| `givenName` / `familyName` | `string \| undefined` | First / last name |
| `locale` | `string \| undefined` | The user's locale |
| `onboarded` | `boolean \| undefined` | Whether onboarding is complete |
| `multiTenantAccess` | `boolean \| undefined` | Whether the user can access more than one workspace |
| `tenant` | `{ id, name, locale?, logo?, onboarded? } \| undefined` | The current workspace's details |

`useProfile()` also returns `isLoading`, `error`, and two convenience booleans derived from the profile: `isOnboarded` and `hasMultiTenantAccess`.

Unlike `bridge.user`, the profile isn't refreshed automatically when something changes server-side — call `updateProfile()` to re-fetch it on demand (for example, right after the user edits their name):

```tsx
const { profile, updateProfile } = useProfile();

async function handleSaveName() {
  await saveNameOnYourBackend();
  await updateProfile();
}
```

`profile` is `undefined` while loading, `null` when not authenticated, and a profile object when authenticated. `<ProfileName />` is a ready-made component if you just need to render the name somewhere — see [Tokens](/auth/ui/tokens/) in UI components.

## The alternative path: `useBridgeToken()` / `getBridgeAuth()`

You almost never need this. Bridge's own SDK calls already carry the token automatically — every request to the Bridge API gets `Authorization: Bearer <token>` injected for you.

Reach for the raw token only when you're calling a backend you control that isn't Bridge's API, and it also needs to verify the user. Inside a component, `useBridgeToken()` gives you accessors:

```tsx
import { useBridgeToken } from '@nebulr-group/bridge-react';

function CallMyBackend() {
  const { getAccessToken } = useBridgeToken();

  async function callBackend() {
    const token = getAccessToken();
    await fetch('https://your-own-api.example.com/work', {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  return <button onClick={callBackend}>Call backend</button>;
}
```

Outside a component (plain TS), call the auth-core singleton directly instead:

```ts
import { getBridgeAuth } from '@nebulr-group/bridge-react';

const token = getBridgeAuth().getTokens()?.accessToken;
```

Both surface the same `{ accessToken, refreshToken, idToken }` token set — the raw JWTs. Bridge refreshes them automatically before they expire, and proactively after your app reconnects from being offline, so you never manage token lifetimes yourself.

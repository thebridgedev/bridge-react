---
title: Getting the user token
description: Read the signed-in user's identity, the recommended way and the alternatives.
sidebar:
  label: React
---

# Getting the user token

The user's token is set the moment they sign in (through `LoginForm`, `SsoButton`, a passkey, magic link, or however your app authenticates them) and Bridge keeps it valid from then on. You never fetch or store it yourself.

## The recommended path: the unified `bridge` object

For almost everything you build, read the signed-in user from `bridge.user`. It's live, reactive, and requires no setup beyond wrapping your app in `<BridgeProvider>`:

```tsx
import { bridge, useBridgeReadable } from '@nebulr-group/bridge-react';

function UserBadge() {
  const user = useBridgeReadable(bridge.user);

  if (!user) return null;
  return <p>{user.email} ({user.role})</p>;
}
```

`bridge.user` exposes:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | The user's unique identifier |
| `email` | `string \| undefined` | The user's email |
| `role` | `string` | The user's role within the current workspace (a workspace is called a *tenant* in the API, hence the next field's name) |
| `tenantId` | `string` | The current workspace's ID |

It's populated from the session snapshot sent over the live channel (a persistent realtime connection the SDK maintains) on connect and every reconnect, so it's always current. See [How the user token is updated](/auth/user-token/object-updates/).

## A one-off imperative read: `getCurrentUser()`

For a single read outside a reactive context (a plain function, an event handler, an analytics call), `bridge.user` is overkill if you don't want to set up a subscription just to read a value once. `getBridgeAuth().getCurrentUser()` reads the same claims synchronously, straight off the current access token, no subscription required:

```ts
import { getBridgeAuth } from '@nebulr-group/bridge-react';

const user = getBridgeAuth().getCurrentUser();
// { id, email?, role?, tenantId?, plan? } | null
```

It returns `null` when there's no valid token. Unlike `bridge.user`, it also includes `plan` (the workspace's plan key), so it's a reasonable choice when you need that alongside identity in one synchronous call. It won't update on its own the way `bridge.user` does; call it again to get a fresh read.

## Richer profile fields: `useProfile()`

`bridge.user` is intentionally minimal. For display fields like full name, avatar-worthy details, or workspace name/logo, use the `useProfile()` hook:

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

Unlike `bridge.user`, the profile isn't refreshed automatically when something changes server-side. Call `updateProfile()` (also returned by the hook) to re-fetch it on demand (for example, right after the user edits their name).

`profile` is `undefined` while loading, `null` when not authenticated, and a profile object when authenticated.

> **Framework note:** `useProfile()` also returns `isLoading`, `error`, and two convenience booleans derived from the profile: `isOnboarded` and `hasMultiTenantAccess`.

### Just rendering the name: `ProfileName`

If all you need is the user's display name somewhere in your UI, skip the hook and drop in the ready-made component:

```tsx
import { ProfileName } from '@nebulr-group/bridge-react';

<ProfileName />
// renders: "John Doe" or "john@example.com" or nothing when not authenticated
```

It outputs a `<span>` with a `data-bridge-profile-name` attribute for styling, and accepts `className` and `style` props. No configuration needed.

## The alternative path: `useBridgeToken()`

You almost never need this. Bridge's own SDK calls already carry the token automatically; every `fetch()` to the Bridge API gets `Authorization: Bearer <token>` injected for you.

Reach for `useBridgeToken()` only when you're calling a backend you control that isn't Bridge's API, and it also needs to verify the user:

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

`useBridgeToken()` exposes accessors for `{ accessToken, refreshToken, idToken }`, the raw JWTs. Bridge refreshes them automatically before they expire, and proactively after your app reconnects from being offline, so you never manage token lifetimes yourself.

> **Framework note:** the hook returns getter functions (`getAccessToken()`, `getRefreshToken()`, `getIdToken()`) rather than the token values themselves. Outside a component (plain TS), read the same token set from the singleton: `getBridgeAuth().getTokens()?.accessToken`.

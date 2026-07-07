---
title: Logging in and logging out
description: How Bridge's JWT-based session works, and how to log a user out.
sidebar:
  label: React
---

# Logging in and logging out

Bridge auth is **JWT-based**. Signing in gets the browser a token set (`accessToken`, `refreshToken`, `idToken`), stored in `localStorage`. Everything else — staying signed in across reloads, staying signed in across tabs, silently refreshing before expiry — follows from that one fact.

## How logging in works

`<BridgeProvider>` initializes the Bridge runtime synchronously on the first client render (not inside a `useEffect`), and that init looks in `localStorage` for a stored token. That check is what decides whether the user sees the app or the login flow:

- **A token is there** — the app starts as authenticated immediately (no round-trip to check it first), then quietly schedules a refresh in the background if the token is close to expiring, so it's valid again before you'd ever notice. This is why reloading the page doesn't bounce a signed-in user back to login.
- **No token is there** — `authState` starts at `'unauthenticated'` and the login flow takes over (see [Sign-in methods](/auth/sign-in/email-password/) and [Auth states](/auth/user-token/auth-states/)).

If a refresh ever fails (the refresh token itself has expired or been revoked), Bridge clears the stored token and drops the user back to `'unauthenticated'` — the same as an explicit logout.

## Logging out

`useAuth()` gives you a `logout()` you can call from any component:

```tsx
import { useAuth } from '@nebulr-group/bridge-react';
import { useNavigate } from 'react-router-dom';

function LogoutButton() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return <button onClick={handleLogout}>Log out</button>;
}
```

`logout()` clears the token from `localStorage` and resets the bridge store (`tokens`, `profile`, `flags`, `authState`, `tenantUsers`) — that's it. It does **not** redirect anywhere on its own; bridge-react is a pure client-side plugin, so navigating after logout is left to your router, unlike bridge-svelte's `getBridgeAuth().logout({ redirectTo })`, which does a hard redirect for you.

If you want that hosted-logout redirect behavior instead — for example, to also end the Bridge-hosted session rather than just clearing local tokens — call the underlying auth-core method directly:

```ts
import { getBridgeAuth } from '@nebulr-group/bridge-react';

await getBridgeAuth().logout({ redirectTo: '/' });
```

- **With `redirectTo`** — the browser goes straight there (an in-app route or any URL of your choosing) via a full page navigation.
- **Without it** — the browser is sent to Bridge's hosted logout page instead.

There's no server-side session to invalidate before either of these — JWTs aren't revocable server-side the way a session cookie is, so "logging out" is always just erasing the stored token (plus, optionally, redirecting).

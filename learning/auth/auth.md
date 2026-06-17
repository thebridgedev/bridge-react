# Authentication

How `@nebulr-group/bridge-react` represents auth state, exposes hooks, and protects routes.

## How it works

`<BridgeProvider>` initializes a singleton `BridgeAuth` (from `@nebulr-group/bridge-auth-core`) on mount. Auth-core emits events:
- `auth:login` — when tokens are issued.
- `auth:logout` — when tokens are cleared.
- `auth:token-refreshed` — when refresh succeeds.
- `auth:state-change` — when the state machine transitions (`unauthenticated` → `mfa-required` → `tenant-selection` → `authenticated`).
- `auth:profile` — when the profile loads or updates.
- `auth:workspace-changed` — when the user switches workspaces.
- `auth:error` — on any auth error.

These events update a Zustand store (`useBridgeStore`) which all the hooks read from.

React is a pure-browser (CSR) plugin — there is no server middleware. Tokens are stored in `localStorage` and route protection runs client-side via `<ProtectedRoute>`.

## Hooks

### `useAuth()`

```tsx
const { isAuthenticated, isLoading, error, login, logout } = useAuth();
```

- `isAuthenticated` — boolean, derived from token presence.
- `isLoading` — `true` until bootstrap completes.
- `login()` — redirects to hosted bridge auth.
- `logout()` — clears tokens and resets state.

### `useProfile()`

```tsx
const { profile, isLoading, error, updateProfile, isOnboarded, hasMultiTenantAccess } = useProfile();
```

`profile` is the auth-core `Profile` type — has `fullName`, `email`, `username`, `onboarded`, `multiTenantAccess`, and an optional `tenant`. It updates automatically when auth-core fires `auth:profile`, `auth:login`, `auth:logout`, or `auth:workspace-changed`, so any component using `useProfile()` re-renders on workspace switch or re-login.

- `updateProfile()` — re-fetch the profile from auth-core; resolves with the `Profile` (or `null`).
- `isOnboarded` / `hasMultiTenantAccess` — convenience booleans derived from the current profile.

## Route protection

React has no server middleware — protect routes client-side with `<ProtectedRoute>`:

```tsx
import { ProtectedRoute } from '@nebulr-group/bridge-react';
import { Route, Routes } from 'react-router-dom';

<Routes>
  <Route
    path="/*"
    element={(
      <ProtectedRoute>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </ProtectedRoute>
    )}
  />
</Routes>
```

When `<ProtectedRoute>` blocks a request it navigates (via the router adapter) to the configured login route (default `/login`). Register the router adapter once in your root component so the plugin can navigate:

```tsx
import { setRouterAdapter } from '@nebulr-group/bridge-react';
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();
setRouterAdapter({
  navigate: (path, options) => navigate(path, { replace: options?.replace }),
  replace: (path) => navigate(path, { replace: true }),
  getCurrentPath: () => window.location.pathname,
});
```

(Adapters for React Router, TanStack Router, and Wouter are exported as `createReactRouterAdapter`, `createTanStackRouterAdapter`, and `createWouterAdapter`.)

## Accessing the profile

```tsx
import { useProfile } from '@nebulr-group/bridge-react';

export function ProfileBadge() {
  const { profile } = useProfile();
  return <span>{profile?.fullName ?? profile?.email}</span>;
}
```

For a simple display name, use `<ProfileName />` — it renders the current user's full name (falling back to email), and renders **nothing** when no profile is loaded:

```tsx
import { ProfileName } from '@nebulr-group/bridge-react';
<ProfileName className="user-name" />
```

`<ProfileName>` reads the profile straight from the bridge store, so it stays in sync without any wiring of its own.

## Authenticated API calls

```tsx
import { getBridgeAuth } from '@nebulr-group/bridge-react';

export async function fetchUser() {
  const token = await getBridgeAuth().getAccessToken();
  const res = await fetch('https://your-api.example.com/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}
```

## Logout flow

`logout()` clears localStorage, fires `auth:logout`, and resets all hooks to unauthenticated state. There's no redirect by default — navigate after it resolves:

```tsx
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();
const { logout } = useAuth();
await logout();
navigate('/');
```

## Common pitfalls

- **`getBridgeAuth()` throws** if called before `<BridgeProvider>` has mounted. Always call it after mount (inside an effect or event handler).
- **OAuth callback preserves `?payment=*`** by default so post-payment pages can read the result after login.
- **Profile not populated yet.** The profile store is populated via `waitForBridge()` before any consumer reads it; treat `profile === undefined` as "still loading" and `null` as "no profile".

## Environment variables

`<BridgeProvider>` is configured by `VITE_BRIDGE_APP_ID` (the Vite env prefix). See the Configuration guide for the full list.

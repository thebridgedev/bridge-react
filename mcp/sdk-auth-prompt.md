# Bridge React — Authentication

You are wiring authentication into a React application that uses The Bridge.

## Decide first — hosted or in-app?

| You want | Mode | What you build | Config |
|---|---|---|---|
| Bridge owns the login UI | **Hosted** (default) | Nothing — no login page at all | No `loginRoute` |
| Login inside your app, your styling | **SDK auth** | Your own routes rendering `<LoginForm>` / `<SignupForm>` | Set `loginRoute` |

**One config field is the entire switch.** Adding `loginRoute` to `BridgeConfig` turns hosted mode off. If you are being redirected to a route you never built, that field is why.

If the user has not said which they want, ask. This is not a detail to infer — a wrong guess means rewriting the auth pages.

The rest of this guide covers **SDK auth**. For hosted, there is nothing to build beyond the callback route in `integration-prompt.md`.

## The components — reach for these, do not hand-roll

| Need | Component |
|---|---|
| Sign in | `<LoginForm>` |
| Sign up | `<SignupForm>` |
| Forgot password | Built into `<LoginForm>` |
| Magic link | Built into `<LoginForm>` |
| Passkey login | Built into `<LoginForm>` |
| MFA challenge / setup | Built into `<LoginForm>` |
| Workspace ("tenant") selection | Built into `<LoginForm>` |
| SSO buttons | Built into `<LoginForm>` |
| Reactive auth state | `useAuth()` |

> **`<LoginForm>` is not just a username and password box.** It handles forgot-password, magic link, passkeys, MFA challenge, MFA setup and workspace selection as inline multi-step flows, and it decides which auth methods to show from the app's own configuration. Building any of those by hand means reimplementing a flow that already exists and then keeping it in sync with the app's settings — which you cannot see from the client.
>
> If you catch yourself writing a password field, stop and check whether `<LoginForm>` already covers the case.

## Prerequisites

1. `@nebulr-group/bridge-react` installed.
2. `<BridgeProvider>` mounted above the router (see `integration-prompt.md`).
3. `VITE_BRIDGE_APP_ID` set.
4. A router adapter registered via `setRouterAdapter`.

If any are missing, run the integration guide first.

## Step 1 — Import the stylesheet

The auth components ship styles. Without this import they render unstyled, which reads as "broken component" rather than "missing CSS":

```tsx
// src/main.tsx
import '@nebulr-group/bridge-react/styles';
```

## Step 2 — Point the config at your login route

```tsx
const config: BridgeConfig = {
  appId: import.meta.env.VITE_BRIDGE_APP_ID,
  loginRoute: '/auth/login',
};
```

## Step 3 — Build the auth pages

```tsx
// src/pages/LoginPage.tsx
import { LoginForm } from '@nebulr-group/bridge-react';

export default function LoginPage() {
  return <LoginForm showSignupLink />;
}
```

```tsx
// src/pages/SignupPage.tsx
import { SignupForm } from '@nebulr-group/bridge-react';

export default function SignupPage() {
  return <SignupForm showLoginLink loginHref="/auth/login" />;
}
```

Optional props on both: `onLogin` (fires after successful auth — analytics, a post-login redirect) and `onError`.

## Step 4 — Guard routes

**bridge-react has no declarative `routeConfig`.** Unlike bridge-svelte, you decide which routes are public in your router, with `useAuth()` supplying reactive state:

```tsx
import { useAuth } from '@nebulr-group/bridge-react';
import { Navigate } from 'react-router-dom';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  // Render nothing while auth resolves — returning the redirect here would
  // bounce a signed-in user to login on every refresh.
  if (isLoading) return null;
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth/login" replace />;
}
```

That `isLoading` check is the one people leave out, and it produces a bug that only shows on a hard refresh.

For hosted mode use the shipped `<ProtectedRoute>` instead — it handles the loading state and starts the hosted flow.

## Reading the user

```tsx
const { isAuthenticated, isLoading, login, logout } = useAuth();
```

For profile fields use `useProfile()`. For the raw token (to call your own backend) use `useBridgeToken()` — send it as `Authorization: Bearer <token>` and verify it server-side with `@nebulr-group/bridge-nestjs` or `@nebulr-group/bridge-express`.

> **Never make an authorization decision on the client alone.** Hiding a button is UX; the check that matters happens on the server against the verified token. A client-side role check is a hint, not a boundary.

## Common mistakes

- **Hand-rolling a password form** instead of `<LoginForm>` — loses magic link, passkeys, MFA and workspace selection, all of which are configured server-side and cannot be replicated from the client.
- **Forgetting `import '@nebulr-group/bridge-react/styles'`** — components look broken.
- **Omitting the `isLoading` branch** in a guard — signed-in users get bounced to login on refresh.
- **Setting `loginRoute` while expecting hosted login**, or the reverse.
- **Trusting `useAuth()` for authorization.** It tells you whether a session exists, not what it may do.

## Configuring auth methods

Which methods appear (password, magic link, passkeys, SSO, MFA) is **app configuration, not code**. It is set over MCP (`update_app`, `enable_auth_methods`), the `bridge` CLI, or the dashboard — and `<LoginForm>` reflects it automatically. Do not add props trying to force a method on: change the app config instead.

## Related guides

- `integration-prompt.md` — provider, router adapter, callback route
- `feature-flags-prompt.md` — gating on flags
- `team-prompt.md` — team management UI

# Bridge React — Authentication

You are wiring authentication into a React application that uses The Bridge.

## Decide first — hosted or in-app?

| You want | Mode | What you build | Config |
|---|---|---|---|
| Bridge owns the login UI | **Hosted** (default) | One `/auth/*` route rendering `<BridgeAuthRoutes />` | No `loginRoute` |
| Login inside your app, your styling | **SDK auth** | The same one `/auth/*` route | `loginRoute: '/auth/login'` |

**One config field is the entire switch.** Adding `loginRoute` to `BridgeConfig` turns hosted mode off. If you are being redirected to a route you never built, that field is why.

If the user has not said which they want, ask. This is not a detail to infer — a wrong guess means rewriting the auth pages.

The rest of this guide covers **SDK auth**. For hosted, there is nothing to build beyond the `/auth/*` route in `integration-prompt.md`.

## The components — reach for these, do not hand-roll

| Need | Component |
|---|---|
| Every sign-in page (login, signup, OAuth callback, set-password, forgot-password, magic-link, setup-passkey, workspaces) | `<BridgeAuthRoutes>` on `/auth/*` |
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
4. React Router 6.4+/7 or TanStack Router 1 (optional peers), or no router at all.

If any are missing, run the integration guide first.

## Step 1 — Import the stylesheet

The auth components ship styles. Without this import they render unstyled, which reads as "broken component" rather than "missing CSS":

```tsx
// src/main.tsx
import '@nebulr-group/bridge-react/styles';
```

## Step 2 — Point the config at your login route

```tsx
// src/main.tsx
<BridgeProvider config={{ loginRoute: '/auth/login' }}>
  <BrowserRouter><App /></BrowserRouter>
</BridgeProvider>
```

The app id comes from `VITE_BRIDGE_APP_ID`; an option you pass explicitly wins over the environment.

## Step 3 — One route serves every auth page

```tsx
// src/App.tsx — React Router
import { ProtectedRoute } from '@nebulr-group/bridge-react';
import { BridgeAuthRoutes } from '@nebulr-group/bridge-react/react-router';

<Routes>
  <Route path="/auth/*" element={<BridgeAuthRoutes />} />
  <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
</Routes>
```

```tsx
// TanStack Router
import { BridgeAuthRoutes } from '@nebulr-group/bridge-react/tanstack-router';

const authRoute = createRoute({ getParentRoute: () => rootRoute, path: 'auth/$', component: BridgeAuthRoutes });
```

Without a router: `<BridgeAuthRoutes base="/auth" />` from the main entry.

**Do not hand-write `/auth/login`, `/auth/signup`, `/auth/set-password/:token` or any other auth page.** The set-password page is where every signup verification email lands; a forgotten one sends every new signup to a 404. `<BridgeAuthRoutes>` owns the list.

Customise in rungs, climbing only as far as needed:

1. `--bridge-*` CSS tokens (colours, radius, spacing).
2. `frame={(page, children) => …}` replaces everything around the form on every page; `heading={(page) => …}` replaces each page's main heading.
3. Take one page over by element: `<BridgeAuthRoutes pages={{ login: <MyLoginPage /> }} />`. A login page you own calls `navigate(readReturnTo(location.search) ?? '/')` in `<LoginForm onLogin>`.
4. Headless: `getBridgeAuth()`.

## Step 4 — Guard routes

Wrap routes that need a signed-in user in `<ProtectedRoute>`. It shows a loading state until auth resolves, then renders its children or sends the visitor to `loginRoute` (or the hosted login), remembering where they were going. It is the same component in both modes.

bridge-react has no declarative `routeConfig`: you decide which routes are public in your router. For a guard of your own, use `useAuth()` and keep the `isLoading` branch — returning a redirect while auth resolves bounces a signed-in user to login on every refresh.

## Reading the user

```tsx
const { isAuthenticated, isLoading, login, logout } = useAuth();
```

For profile fields use `useProfile()`. For the raw token (to call your own backend) use `useBridgeToken()` — send it as `Authorization: Bearer <token>` and verify it server-side with `@nebulr-group/bridge-nestjs` or `@nebulr-group/bridge-express`.

> **Never make an authorization decision on the client alone.** Hiding a button is UX; the check that matters happens on the server against the verified token. A client-side role check is a hint, not a boundary.

## Common mistakes

- **Hand-writing auth pages** instead of mounting `<BridgeAuthRoutes>` on `/auth/*` — the page you forget (usually set-password) is a 404 in every verification email.
- **Hand-rolling a password form** instead of `<LoginForm>` — loses magic link, passkeys, MFA and workspace selection, all of which are configured server-side and cannot be replicated from the client.
- **Forgetting `import '@nebulr-group/bridge-react/styles'`** — components look broken.
- **Omitting the `isLoading` branch** in a guard — signed-in users get bounced to login on refresh.
- **Setting `loginRoute` while expecting hosted login**, or the reverse.
- **Trusting `useAuth()` for authorization.** It tells you whether a session exists, not what it may do.

## Configuring auth methods

Which methods appear (password, magic link, passkeys, SSO, MFA) is **app configuration, not code**. It is set over MCP (`update_app`, `enable_auth_methods`), the `bridge` CLI, or the dashboard — and `<LoginForm>` reflects it automatically. Do not add props trying to force a method on: change the app config instead.

## Related guides

- `integration-prompt.md` — provider, environment, the `/auth/*` route
- `feature-flags-prompt.md` — gating on flags
- `team-prompt.md` — team management UI

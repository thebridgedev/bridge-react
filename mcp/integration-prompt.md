# Bridge React Integration

You are integrating The Bridge into a React application. This adds authentication, tenant context, role and privilege access control, feature flags and billing to a React SPA.

## Decide first — which login surface?

This is the only decision that shapes the rest of the integration, and getting it wrong means rewriting the auth pages. Make it before you write anything.

| You want | Use | What you build |
|---|---|---|
| The fastest path; Bridge owns the login UI | **Hosted auth** (default) | Nothing. No login page, no signup page, no forms |
| Login inside your own app, your own styling | **SDK auth** | `<LoginForm>`, `<SignupForm>` etc. from this package, on your own routes |

**Hosted is the default and needs no `loginRoute`.** Adding `loginRoute` to the config is what switches the SDK into in-app mode — that single field is the whole switch, which is easy to set by accident and then wonder why you are being redirected to a route you never built.

If the user has not said, ask. Do not guess: a wrong guess here is the most expensive rework in this guide.

## Prerequisites

- **appId** — get it from `get_app` (MCP), `bridge app get` (CLI), or the dashboard.
- **A React 18+ app** with client-side rendering. Bridge requires CSR; a standard Vite + React SPA needs no extra setup.
- **A router.** React Router is used below, but any router works.
- **Package manager** — use whatever the project already uses (check for `bun.lock`, `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`).

## Step 1 — Install

```bash
npm i @nebulr-group/bridge-react
```

## Step 2 — Configure the environment

Keep environment-specific values out of source:

```env
# .env
VITE_BRIDGE_APP_ID=your-app-id-here
VITE_BRIDGE_DEFAULT_REDIRECT_ROUTE=/dashboard
```

`<BridgeProvider>` reads `VITE_BRIDGE_*` (Vite) and `REACT_APP_BRIDGE_*` (Create React App) automatically, and **env vars take priority over props**. Worth knowing when a config value you passed appears to be ignored.

## Step 3 — Mount the provider

`<BridgeProvider>` mounts the Bridge runtime once for the whole app. It goes **above the router**:

```tsx
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { BridgeProvider, type BridgeConfig } from '@nebulr-group/bridge-react';
import App from './App';

const config: BridgeConfig = {
  appId: import.meta.env.VITE_BRIDGE_APP_ID,
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BridgeProvider config={config}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </BridgeProvider>
  </StrictMode>,
);
```

Common `BridgeConfig` fields:

| Field | Default | Description |
|---|---|---|
| `appId` | **required** | Your Bridge app ID |
| `callbackUrl` | `<origin>/auth/oauth-callback` | Where hosted login redirects back to |
| `defaultRedirectRoute` | `'/'` | Where to land after login |
| `loginRoute` | — | **Setting this switches to SDK (in-app) auth** |
| `debug` | `false` | Debug logging |

## Step 4 — Register a router adapter

Bridge navigates on your behalf (after login, on a guard redirect). It needs to know how:

```tsx
useEffect(() => {
  setRouterAdapter({
    navigate: (path, options) => navigate(path, { replace: options?.replace }),
    replace: (path) => navigate(path, { replace: true }),
    getCurrentPath: () => window.location.pathname,
  });
}, [navigate]);
```

Prebuilt factories ship for the common routers: `createReactRouterAdapter`, `createTanStackRouterAdapter`, `createWouterAdapter`. Prefer one of those over hand-rolling the object.

**Skipping this is the most common integration bug.** Auth appears to work, then a post-login redirect does a full page reload or lands nowhere.

## Step 5 — Add the callback route and protect routes

```tsx
// src/App.tsx
import { CallbackHandler, ProtectedRoute, setRouterAdapter } from '@nebulr-group/bridge-react';
import { Routes, Route, useNavigate } from 'react-router-dom';

function App() {
  const navigate = useNavigate();
  useEffect(() => { /* setRouterAdapter as above */ }, [navigate]);

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      {/* Must exist, or the redirect back from login 404s */}
      <Route path="/auth/oauth-callback" element={<CallbackHandler />} />

      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Routes>
              <Route path="/dashboard" element={<DashboardPage />} />
            </Routes>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
```

`<ProtectedRoute>` shows a loading state until auth resolves, then either renders its children or starts the login flow — hosted portal or your `loginRoute`, depending on config.

## Step 6 — Read the user

```tsx
import { useAuth } from '@nebulr-group/bridge-react';

function Header() {
  const { isAuthenticated, login, logout } = useAuth();
  return isAuthenticated
    ? <button onClick={logout}>Log out</button>
    : <button onClick={() => login()}>Log in</button>;
}
```

## Verify it works

Do not declare this done on a clean type-check. Run the app and confirm:

1. Visiting a protected route while signed out starts the login flow.
2. Completing login lands you back **inside the app**, not on the callback URL.
3. A reload keeps you signed in.
4. Logout returns you to a public route.

Step 2 is the one that catches a missing router adapter, and it is invisible in any test that does not use a real browser.

## Where to go next

| Goal | Guide |
|---|---|
| Build login/signup inside your app | `sdk-auth-prompt.md` |
| Gate features behind a flag | `feature-flags-prompt.md` |
| Plans, checkout, quotas | `billing-prompt.md` |
| Team / workspace management UI | `team-prompt.md` |

Configuring the Bridge app itself — flags, plans, roles, Stripe — is done over **MCP tools** or the **`bridge` CLI**, not in app code. Both are equivalent; use whichever you have.

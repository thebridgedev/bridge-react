# Bridge React Integration

You are integrating The Bridge into a React application. This adds authentication, tenant context, role and privilege access control, feature flags and billing to a React SPA.

## Decide first — which login surface?

This is the only decision that shapes the rest of the integration, and getting it wrong means rewriting the auth pages. Make it before you write anything.

| You want | Use | What you build |
|---|---|---|
| The fastest path; Bridge owns the login UI | **Hosted auth** (default) | Nothing beyond the one `/auth/*` route below |
| Login inside your own app, your own styling | **SDK auth** | The same one `/auth/*` route, plus `loginRoute: '/auth/login'` in the config |

**Hosted is the default and needs no `loginRoute`.** Adding `loginRoute: '/auth/login'` is the whole switch to in-app mode. Either way `<BridgeAuthRoutes>` serves every sign-in page (login, signup, the OAuth callback, set-password, forgot-password, magic-link, setup-passkey, workspaces) from one route: **never hand-write those pages.**

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

React Router (6.4+ or 7) or TanStack Router is an optional peer: install nothing extra if the app already has one.

## Step 2 — Configure the environment

```env
# .env
VITE_BRIDGE_APP_ID=your-app-id-here
```

`<BridgeProvider>` reads `VITE_BRIDGE_*` (Vite) and `REACT_APP_BRIDGE_*` (Create React App) itself. Each field resolves as **explicit option > environment > default**, so do not copy variables into a config object by hand. With no app id anywhere, the provider refuses to start and logs which variable to set.

**For a non-production app, set `VITE_BRIDGE_API_BASE_URL` too** (e.g. `https://api-stage.thebridge.dev`). Unset means production, and a stage or local app id against the production API does not exist there; in a development build the provider says so once in the console. The hosted login address follows the API address on Bridge's own domains, so `VITE_BRIDGE_HOSTED_URL` is only for a local or self-hosted Bridge.

## Step 3 — Mount the provider

`<BridgeProvider>` mounts the Bridge runtime once for the whole app. It goes **above the router**:

```tsx
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { BridgeProvider } from '@nebulr-group/bridge-react';
import '@nebulr-group/bridge-react/styles';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* SDK auth: config={{ loginRoute: '/auth/login' }}. Hosted auth: no props. */}
    <BridgeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </BridgeProvider>
  </StrictMode>,
);
```

Common `BridgeConfig` fields (all optional when the environment is set):

| Field | Default | Description |
|---|---|---|
| `appId` | `VITE_BRIDGE_APP_ID` | Your Bridge app ID |
| `apiBaseUrl` | `VITE_BRIDGE_API_BASE_URL`, else production | Only for stage / local / self-hosted |
| `loginRoute` | — | **Setting this switches to SDK (in-app) auth** |
| `defaultRedirectRoute` | `'/'` | Where to land after login |
| `billing` | see `billing-prompt.md` | Subscription pages, paywall, upgrade dialog |
| `debug` | `false` | Debug logging |

## Step 4 — Mount Bridge's routes and protect yours

```tsx
// src/App.tsx
import { ProtectedRoute } from '@nebulr-group/bridge-react';
import { BridgeAuthRoutes } from '@nebulr-group/bridge-react/react-router';
import { Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      {/* every sign-in page, including the OAuth callback — public */}
      <Route path="/auth/*" element={<BridgeAuthRoutes />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
    </Routes>
  );
}
```

**TanStack Router:** import `BridgeAuthRoutes` from `@nebulr-group/bridge-react/tanstack-router` and mount it with `createRoute({ getParentRoute: () => rootRoute, path: 'auth/$', component: BridgeAuthRoutes })` (file-based: `src/routes/auth/$.tsx`). **No router:** `<BridgeAuthRoutes base="/auth" />` from the main entry.

The adapter components also register the router as Bridge's navigation, so the guard, the OAuth callback and the paywall redirect stay in-app. An app that renders none of them calls `useBridgeRouter()` from the same entry once inside the router — skipping that makes post-login redirects full page reloads.

`<ProtectedRoute>` shows a loading state until auth resolves, then either renders its children or starts the login flow — hosted portal or your `loginRoute`, remembering the page the visitor asked for.

To change how the sign-in pages look: `--bridge-*` CSS tokens first; then `frame(page, children)` / `heading(page)` render props on `<BridgeAuthRoutes>`; then take one page over by element, `pages={{ login: <MyLoginPage /> }}`. See `learning/mechanisms.md`.

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

Step 2 is the one that catches a missing router registration, and it is invisible in any test that does not use a real browser.

## Where to go next

| Goal | Guide |
|---|---|
| The rules everything builds on (limits, levels, customising) | `learning/mechanisms.md` |
| Build login/signup inside your app | `sdk-auth-prompt.md` |
| Gate features behind a flag | `feature-flags-prompt.md` |
| Plans, checkout, quotas | `billing-prompt.md` |
| Team / workspace management UI | `team-prompt.md` |

Configuring the Bridge app itself — flags, plans, roles, Stripe — is done over **MCP tools** or the **`bridge` CLI**, not in app code. Both are equivalent; use whichever you have.

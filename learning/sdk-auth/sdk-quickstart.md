# SDK auth quickstart

> This guide covers in-app SDK auth components. For the simplest setup using Bridge's hosted login page, see the [Hosted auth quickstart](../quickstart/hosted-quickstart.md).

Get up and running with The Bridge React plugin using in-app SDK auth components, with no redirects to external login pages.

## 1. Install the plugin

```bash
npm i @nebulr-group/bridge-react
```

## 2. Configuration (`.env` and `src/main.tsx`)

Put your app id in `.env`. For a stage or local app, add its API address too; a production app needs only the first line.

```env
VITE_BRIDGE_APP_ID=your-app-id-here
# VITE_BRIDGE_API_BASE_URL=https://api-stage.thebridge.dev
```

Wrap your app in `<BridgeProvider>` at the root. `loginRoute` is the switch to in-app sign-in: with it, Bridge sends signed-out visitors to your own login page instead of its hosted one. Import the plugin's stylesheet here too so the auth forms render styled.

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
    <BridgeProvider config={{ loginRoute: '/auth/login' }}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </BridgeProvider>
  </StrictMode>,
);
```

Key points:
- **`<BridgeProvider>` reads `VITE_BRIDGE_*` itself** (`REACT_APP_BRIDGE_*` under Create React App). Anything you pass in `config` wins over the environment.
- **`<BridgeProvider>` sits above the router**: it mounts the Bridge runtime once for the whole app.
- **Client-side rendering**: Bridge requires client-side rendering; a standard Vite + React SPA needs no extra configuration.

## 3. Every sign-in page from one route (`src/App.tsx`)

`<BridgeAuthRoutes>` serves login, signup, the OAuth callback, set password (where verification and password-reset emails land), forgot password, magic link, passkey setup and workspace selection. Mount it once under `/auth/*`, and guard the routes that need a signed-in user with `<ProtectedRoute>`:

```tsx
// src/App.tsx
import { ProtectedRoute } from '@nebulr-group/bridge-react';
import { BridgeAuthRoutes } from '@nebulr-group/bridge-react/react-router';
import { Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/auth/*" element={<BridgeAuthRoutes />} />

      {/* Requires a signed-in user */}
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
    </Routes>
  );
}

export default App;
```

`<ProtectedRoute>` sends a signed-out visitor to `/auth/login` and remembers where they were going; after sign-in they land back there.

With **TanStack Router**, import the same component from `@nebulr-group/bridge-react/tanstack-router` and mount it on a splat route:

```tsx
import { BridgeAuthRoutes } from '@nebulr-group/bridge-react/tanstack-router';

const authRoute = createRoute({ getParentRoute: () => rootRoute, path: 'auth/$', component: BridgeAuthRoutes });
```

Without a router, render `<BridgeAuthRoutes base="/auth" />` from `@nebulr-group/bridge-react` wherever your app handles `/auth/...` paths. The router packages are optional peers: install only the one you use.

Auth method visibility (magic link, passkeys, SSO) is derived from your app's configuration in the Control Center (your admin dashboard at app.thebridge.dev), so turning one on needs no code. The login form handles multi-step flows inline: forgot password, magic link requests, passkey login, MFA challenge, MFA setup, and workspace selection (a workspace is called a *tenant* in the API).

## 4. Customise the pages

Climb only as far as you need:

- **Tokens:** set `--bridge-*` CSS variables (see [Theming](../theming/theming.md)).
- **Frame and heading:** `frame(page, children)` replaces everything around the form on every page; `heading(page)` replaces each page's main heading.

  ```tsx
  <BridgeAuthRoutes
    frame={(page, children) => <main className="auth-card">{children}</main>}
    heading={(page) => <h1>{page === 'signup' ? 'Create your account' : 'Welcome back'}</h1>}
  />
  ```

- **Take over one page** by passing an element for it; every other page keeps working:

  ```tsx
  <BridgeAuthRoutes pages={{ login: <MyLoginPage /> }} />
  ```

  A login page you own navigates itself after sign-in, e.g. `<LoginForm onLogin={() => navigate(readReturnTo(location.search) ?? '/')} />`.

- **Headless:** build your own UI on `getBridgeAuth()`.

Other props: `redirectTo` (where a completed sign-in lands when there is no deep link, default `/`), `messages` (copy overrides), `notFound` (shown for an unknown address under `/auth`).

## 5. After a signup

After a successful signup the user receives a verification email. Its link lands on `/auth/set-password/<token>`, which `<BridgeAuthRoutes>` already serves. Once verified, they can sign in.

## 6. Styles

See [Theming & Styles](../theming/theming.md) for customization options.

## 7. Configuration

The `config` object you pass to `<BridgeProvider>` is a `BridgeConfig`. Every field resolves as *explicit option > environment > default*. The most common fields:

| Field | Environment | Default | Description |
|-------|-------------|---------|-------------|
| `appId` | `VITE_BRIDGE_APP_ID` | **(required)** | Your Bridge app ID. Missing everywhere, Bridge refuses to start and names the variable |
| `apiBaseUrl` | `VITE_BRIDGE_API_BASE_URL` | production | Only for a stage, local or self-hosted app |
| `loginRoute` | `VITE_BRIDGE_LOGIN_ROUTE` | (none: hosted login) | Your in-app login page, e.g. `/auth/login` |
| `defaultRedirectRoute` | `VITE_BRIDGE_DEFAULT_REDIRECT_ROUTE` | `'/'` | Route to land on after login |
| `debug` | `VITE_BRIDGE_DEBUG` | `false` | Enable debug logging |

Under Create React App the variables are `REACT_APP_BRIDGE_*`. See the [Configuration reference](/auth/config/) for the full list (token storage, billing routes).

## Next steps

- **More auth UI components**: [MFA](/auth/ui/mfa/), [passkeys](/auth/ui/passkeys/), [magic link](/auth/ui/magic-link/), [SSO login button](/auth/ui/google-sso/), [switching workspaces](/auth/ui/switching-workspaces/), and [user & team management](/auth/ui/team-management/).
- **The user token**: [logging in and logging out](/auth/user-token/logging-in-and-out/), [getting the token](/auth/user-token/getting-the-token/), and [auth states](/auth/user-token/auth-states/).
- **Route protection**: [frontend route guards](/auth/securing/route-guards/), or browse the full [Auth](/auth/) section.
- **Feature flags and billing**: [how flags work](/feature-flags/how-it-works/) and [how billing works](/billing/how-it-works/).

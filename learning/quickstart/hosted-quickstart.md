# Hosted auth quickstart

The fastest way to add authentication to your React app. Bridge handles the entire login UI on a hosted page, so you don't need to build any auth forms.

## 1. Install the plugin

```bash
npm i @nebulr-group/bridge-react
```

## 2. Configuration (`.env` and `src/main.tsx`)

Put your app id in `.env`. For a stage or local app, add its API address too; the hosted login address follows it on Bridge's own domains (`api-stage` → `auth-stage`).

```env
VITE_BRIDGE_APP_ID=your-app-id-here
# VITE_BRIDGE_API_BASE_URL=https://api-stage.thebridge.dev
```

Wrap your app in `<BridgeProvider>` at the root. It reads the variables itself, so for hosted auth it needs no props.

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
    <BridgeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </BridgeProvider>
  </StrictMode>,
);
```

Key points:
- **No `loginRoute`**: without it, Bridge sends signed-out visitors to the hosted login page. Setting `loginRoute: '/auth/login'` is the whole switch to in-app sign-in (see the [SDK auth quickstart](../sdk-auth/sdk-quickstart.md)); the routes below stay the same.
- **`<BridgeProvider>` sits above the router**: it mounts the Bridge runtime once for the whole app.
- **Client-side rendering**: Bridge requires client-side rendering; a standard Vite + React SPA needs no extra configuration.

## 3. Mount Bridge's routes and protect yours (`src/App.tsx`)

`<BridgeAuthRoutes>` on `/auth/*` serves the page the hosted login redirects back to (`/auth/oauth-callback`), which exchanges the code and takes the user into your app. Wrap the routes that require a signed-in user in `<ProtectedRoute>`: it shows a loading state until auth resolves and starts the hosted login flow when the user isn't signed in.

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

The `/react-router` entry also registers React Router as Bridge's navigation, so redirects stay in-app. With **TanStack Router**, import `BridgeAuthRoutes` from `@nebulr-group/bridge-react/tanstack-router` and mount it on an `auth/$` route. Without a router, render `<BridgeAuthRoutes base="/auth" />` from the main entry. The router packages are optional peers.

## 4. That's it: no login page needed

With hosted auth, Bridge redirects unauthenticated users to the Bridge hosted login UI. When they finish, they come back to `/auth/oauth-callback`, which `<BridgeAuthRoutes>` handles, and land on the page they first asked for (or `/`). The other auth addresses under `/auth` point at the hosted login too.

You do not need to create any login, signup or callback pages.

## 5. Configuration

The `config` object you pass to `<BridgeProvider>` is a `BridgeConfig`. Every field resolves as *explicit option > environment > default*; an option you pass in code wins over `.env`. The most common fields:

| Field | Environment | Default | Description |
|-------|-------------|---------|-------------|
| `appId` | `VITE_BRIDGE_APP_ID` | **(required)** | Your Bridge app ID. Missing everywhere, Bridge refuses to start and names the variable |
| `apiBaseUrl` | `VITE_BRIDGE_API_BASE_URL` | production | Only for a stage, local or self-hosted app |
| `hostedUrl` | `VITE_BRIDGE_HOSTED_URL` | follows `apiBaseUrl` | Only for a local or self-hosted Bridge |
| `callbackUrl` | `VITE_BRIDGE_CALLBACK_URL` | `<origin>/auth/oauth-callback` | Where the hosted login page redirects back to |
| `defaultRedirectRoute` | `VITE_BRIDGE_DEFAULT_REDIRECT_ROUTE` | `'/'` | Route to land on after login |
| `debug` | `VITE_BRIDGE_DEBUG` | `false` | Enable debug logging |

Under Create React App the variables are `REACT_APP_BRIDGE_*`. See the [Configuration reference](/auth/config/) for the full list (token storage, signup route, billing routes).

## Next steps

- **In-app auth forms**: if you want to embed login/signup forms directly in your app instead of using the hosted page, see the [SDK auth quickstart](../sdk-auth/sdk-quickstart.md).
- **Theming**: customize the look of Bridge components with CSS variables and overrides. See [Theming & Styles](../theming/theming.md).
- **Going further**: add [feature flags](/feature-flags/how-it-works/), [billing and subscriptions](/billing/how-it-works/), or explore the full [Auth](/auth/) section.

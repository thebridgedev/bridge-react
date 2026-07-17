# Hosted auth quickstart

The fastest way to add authentication to your React app. Bridge handles the entire login UI on a hosted page, so you don't need to build any auth forms.

## 1. Install the plugin

```bash
npm i @nebulr-group/bridge-react
```

## 2. Configuration (`src/main.tsx`)

Initialize Bridge by wrapping your app in `<BridgeProvider>` at the root. For hosted auth, you only need `appId`. No `loginRoute` is needed because Bridge redirects unauthenticated users to the hosted login page automatically.

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

Key points:
- **No `loginRoute`**: without it, Bridge redirects to the hosted login page instead of an in-app route.
- **`<BridgeProvider>` sits above the router**: it mounts the Bridge runtime once for the whole app.
- **Client-side rendering**: Bridge requires client-side rendering; a standard Vite + React SPA needs no extra configuration.

## 3. Protect your routes (`src/App.tsx`)

Wrap the routes that require a signed-in user in `<ProtectedRoute>`. It shows a loading state until auth resolves and starts the hosted login flow automatically when the user isn't signed in. Register a router adapter once so Bridge can navigate with your router.

```tsx
// src/App.tsx
import { CallbackHandler, ProtectedRoute, setRouterAdapter } from '@nebulr-group/bridge-react';
import { useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';

function App() {
  const navigate = useNavigate();

  useEffect(() => {
    setRouterAdapter({
      navigate: (path, options) => navigate(path, { replace: options?.replace }),
      replace: (path) => navigate(path, { replace: true }),
      getCurrentPath: () => window.location.pathname,
    });
  }, [navigate]);

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/auth/oauth-callback" element={<CallbackHandler />} />

      {/* Everything below requires auth */}
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

export default App;
```

> **Framework note:** React Router is shown here, but any router works.
> Prebuilt adapter factories ship for the common ones:
> `createReactRouterAdapter`, `createTanStackRouterAdapter`, and
> `createWouterAdapter`.

## 4. Add the callback route

Your router needs a route to exist so it doesn't render a 404 when Bridge redirects back to your app. That's the `/auth/oauth-callback` route from step 3:

```tsx
<Route path="/auth/oauth-callback" element={<CallbackHandler />} />
```

The `CallbackHandler` component handles the OAuth callback token exchange automatically and then redirects into your app.

## 5. That's it: no login page needed

With hosted auth, Bridge automatically redirects unauthenticated users to the Bridge hosted login UI. When the user completes authentication on the hosted page, they are redirected back to the callback route you created in step 4.

You do not need to create any login or signup pages.

## 6. Configuration

The `config` object you pass to `<BridgeProvider>` is a `BridgeConfig`. The most common fields:

| Field | Default | Description |
|-------|---------|-------------|
| `appId` | **(required)** | Your Bridge app ID |
| `callbackUrl` | `<origin>/auth/oauth-callback` | Where the hosted login page redirects back to |
| `defaultRedirectRoute` | `'/'` | Route to land on after login |
| `debug` | `false` | Enable debug logging |

See the [Configuration reference](/auth/config/) for the full list (token storage, signup route, billing routes).

Rather than hardcoding environment-specific values, keep them in a `.env` file. `<BridgeProvider>` reads `VITE_BRIDGE_*` (Vite) and `REACT_APP_BRIDGE_*` (Create React App) environment variables automatically, and they take priority over props:

```env
VITE_BRIDGE_APP_ID=your-app-id-here
VITE_BRIDGE_DEFAULT_REDIRECT_ROUTE=/dashboard
```

```tsx
// With env vars in place, the provider needs no config at all:
<BridgeProvider>
  <App />
</BridgeProvider>
```

Supported keys: `VITE_BRIDGE_APP_ID`, `VITE_BRIDGE_API_BASE_URL`, `VITE_BRIDGE_CALLBACK_URL`, `VITE_BRIDGE_DEFAULT_REDIRECT_ROUTE`, `VITE_BRIDGE_LOGIN_ROUTE`, `VITE_BRIDGE_DEBUG` (and their `REACT_APP_BRIDGE_*` equivalents).

## Next steps

- **In-app auth forms**: if you want to embed login/signup forms directly in your app instead of using the hosted page, see the [SDK auth quickstart](../sdk-auth/sdk-quickstart.md).
- **Theming**: customize the look of Bridge components with CSS variables and overrides. See [Theming & Styles](../theming/theming.md).
- **Going further**: add [feature flags](/feature-flags/how-it-works/), [billing and subscriptions](/billing/how-it-works/), or explore the full [Auth](/auth/) section.

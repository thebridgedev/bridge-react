# Configuration Reference

### BridgeConfig type

The config object you can pass to `<BridgeProvider config={...}>` (every field is also settable via a `VITE_BRIDGE_*` env var — see below). It extends auth-core's `BridgeAuthConfig`:

```typescript
interface BridgeConfig {
  /** Your Bridge application ID (required) */
  appId: string;

  /** Where the login flow redirects back to.
   *  @default `${window.location.origin}/auth/oauth-callback` */
  callbackUrl?: string;

  /** Base URL for the Bridge API. All endpoints are derived from this.
   *  @default 'https://api.thebridge.dev' */
  authBaseUrl?: string;

  /** Route to redirect to after login. @default '/' */
  defaultRedirectRoute?: string;

  /** In-app route of your login page. Leave unset for hosted auth —
   *  without it, unauthenticated users go to the Bridge hosted login page. */
  loginRoute?: string;

  /** In-app route of your signup page (SDK auth). */
  signupRoute?: string;

  /** Hosted team-management portal URL. */
  teamManagementUrl?: string;

  /** Enable debug logging. @default false */
  debug?: boolean;
}
```

### Wiring `<BridgeProvider>`

Wrap your app once at the root (e.g. in `src/main.tsx`). The simplest form passes just an `appId`:

```tsx
// src/main.tsx
import { BridgeProvider } from '@nebulr-group/bridge-react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BridgeProvider appId="your-app-id">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </BridgeProvider>
  </StrictMode>
);
```

To pass config explicitly, use the `config` prop:

```tsx
<BridgeProvider config={{ appId: 'your-app-id', loginRoute: '/login' }}>
  {/* ... */}
</BridgeProvider>
```

A common pattern is to read the config from env once and pass it through:

```tsx
import type { BridgeConfig } from '@nebulr-group/bridge-react';

const bridgeConfig: BridgeConfig = {
  appId: import.meta.env.VITE_BRIDGE_APP_ID,
  authBaseUrl: import.meta.env.VITE_BRIDGE_AUTH_BASE_URL,
};

<BridgeProvider config={bridgeConfig}>{/* ... */}</BridgeProvider>
```

`<BridgeProvider>` initializes the Bridge runtime synchronously on the first render and is idempotent — a second provider instance reuses the existing singleton.

### Route protection — `<ProtectedRoute>`

bridge-react has no server, so route protection is client-side. Wrap protected routes in `<ProtectedRoute>` (it auto-starts the hosted login flow for unauthenticated users) and register a `<CallbackHandler>` for the OAuth callback. Bind the router adapter once so the SDK can navigate:

```tsx
// src/App.tsx
import { CallbackHandler, ProtectedRoute, setRouterAdapter } from '@nebulr-group/bridge-react';
import { useEffect } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';

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
      <Route path="/auth/oauth-callback" element={<CallbackHandler />} />

      {/* Protected subtree */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Routes>
              <Route path="/dashboard" element={<Dashboard />} />
            </Routes>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
```

For flag-gated rendering of an individual element, use the `<FeatureFlag>` component or the `useFlag` hook — see the Feature Flags guide.

### Passing values via .env

Keep environment-specific values in `.env` (or `.env.local`) instead of hardcoding them. With Vite the **`VITE_` prefix is required** for values to reach the browser:

```env
VITE_BRIDGE_APP_ID=your-app-id-here
VITE_BRIDGE_AUTH_BASE_URL=https://api.thebridge.dev
VITE_BRIDGE_CALLBACK_URL=http://localhost:3000/auth/oauth-callback
VITE_BRIDGE_DEFAULT_REDIRECT_ROUTE=/
VITE_BRIDGE_LOGIN_ROUTE=/login
VITE_BRIDGE_SIGNUP_ROUTE=/signup
VITE_BRIDGE_TEAM_MANAGEMENT_URL=https://backendless.nblocks.cloud/user-management-portal/users
VITE_BRIDGE_DEBUG=true
```

bridge-react also recognizes the **`REACT_APP_BRIDGE_*`** prefix (for Create React App / webpack toolchains). Use whichever prefix matches your bundler — `VITE_BRIDGE_*` for Vite, `REACT_APP_BRIDGE_*` for CRA:

```env
REACT_APP_BRIDGE_APP_ID=your-app-id-here
REACT_APP_BRIDGE_AUTH_BASE_URL=https://api.thebridge.dev
```

Note that env vars are read at the application level (e.g. via `import.meta.env` in Vite) and passed into the `config` / `appId` props — env values you wire in win over hardcoded defaults, which is handy for per-environment overrides without touching code.

### Reading the resolved config at runtime

Read the active config from any component with `useAppConfig`:

```tsx
import { useAppConfig } from '@nebulr-group/bridge-react';

export function ConfigBadge() {
  const config = useAppConfig();
  if (!config) return null;
  return (
    <>
      <p>App ID: {config.appId}</p>
      <p>API Base: {config.authBaseUrl}</p>
    </>
  );
}
```

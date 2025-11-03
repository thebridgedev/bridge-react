# Bridge React Quickstart Guide

Get started with bridge authentication, feature flags, and team management in your React application.

---

## Step 1: Installation

Install the bridge React plugin:

```bash
npm add @nebulr-group/bridge-react
```

---

## Step 2: Add BridgeProvider

Wrap your application with the `BridgeProvider` and pass your `appId`:

```tsx
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BridgeProvider } from '@nebulr-group/bridge-react';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BridgeProvider appId="YOUR_APP_ID">
      <App />
    </BridgeProvider>
  </React.StrictMode>
);
```

---

## Step 3: Set up OAuth callback and protect your routes

Use the built-in `CallbackHandler` for the `/auth/oauth-callback` route, and wrap all protected routes in a single `ProtectedRoute`. The component auto-starts the hosted login flow; no local `/login` page is needed.

```tsx
// src/App.tsx
import { CallbackHandler, ProtectedRoute, setRouterAdapter } from '@nebulr-group/bridge-react';
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';

function RouterAdapterBinder() {
  const navigate = useNavigate();
  useEffect(() => {
    setRouterAdapter({
      navigate: (path, options) => navigate(path, { replace: options?.replace }),
      replace: (path) => navigate(path, { replace: true }),
      getCurrentPath: () => window.location.pathname
    });
  }, [navigate]);
  return null;
}

function App() {
  return (
    <BrowserRouter>
      <RouterAdapterBinder />
      <Routes>
        {/* Public routes */}
        <Route path="/auth/oauth-callback" element={<CallbackHandler />} />

        {/* Protected subtree */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Routes>
                {/* Your protected routes */}
                <Route path="/" element={<div>Home</div>} />
                {/* <Route path="/dashboard" element={<Dashboard />} /> */}
              </Routes>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
```

Notes:
- `ProtectedRoute` auto-initiates the hosted login if the user is unauthenticated; no local `/login` route is required.
- `CallbackHandler` reads `code`/`error`, exchanges the code, sets tokens, and redirects using `useBridgeConfig()` (`defaultRedirectRoute`, `loginRoute`). If you don’t have a local login page, set `loginRoute` to a public route like `'/'` for error redirects.

---

## That’s it!

You’re done. For login UI, route protection, feature flags, profiles and more, see the full [Examples](../examples/examples.md).

 
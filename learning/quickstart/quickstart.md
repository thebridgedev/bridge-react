# Bridge React Quickstart Guide

Get started with bridge authentication, feature flags, and team management in your React application.

---

## Step 1: Installation

Install the bridge React plugin:

```bash
bun add @nebulr-group/bridge-react
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

## Step 3: Set up the OAuth callback route (single, clear path)

Use the built-in `CallbackHandler` for a process-and-redirect flow. The route path should be `/auth/oauth-callback`.

```tsx
// src/App.tsx
import { CallbackHandler, setRouterAdapter } from '@nebulr-group/bridge-react';
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
        {/* Your routes */}
        <Route path="/auth/oauth-callback" element={<CallbackHandler />} />
      </Routes>
    </BrowserRouter>
  );
}
```

Notes:
- `CallbackHandler` reads `code`/`error` from the URL, exchanges the code, sets tokens, and redirects using `useBridgeConfig()` (`defaultRedirectRoute`, `loginRoute`).
- `setRouterAdapter` makes redirects work with React Router (otherwise falls back to `window.location.replace`).

---


## That’s it!

You’re done. For login UI, route protection, feature flags, profiles and more, see the full [Examples](../examples/examples.md).


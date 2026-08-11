---
title: Route guards
description: Frontend route guards for React.
sidebar:
  label: React
---
import { Tabs, TabItem } from '@astrojs/starlight/components';

# Route guards

Wrap your app in `<BridgeProvider>` once at the root, then wrap any route element that needs auth in the `ProtectedRoute` component. `ProtectedRoute` handles the login redirect automatically.

<Tabs>
<TabItem label="main.tsx">

```tsx
// src/main.tsx
import { BridgeProvider } from '@nebulr-group/bridge-react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <BridgeProvider appId={import.meta.env.VITE_BRIDGE_APP_ID}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </BridgeProvider>
);
```

</TabItem>
<TabItem label="App.tsx">

```tsx
// src/App.tsx
import { ProtectedRoute } from '@nebulr-group/bridge-react';
import { Route, Routes } from 'react-router-dom';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/auth/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={(
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        )}
      />
    </Routes>
  );
}
```

</TabItem>
</Tabs>

**How it works:**

| Piece | What it does |
|--------|--------------|
| `<ProtectedRoute>` | While auth state is loading it renders a loading placeholder. Once resolved, an unauthenticated user is sent to Bridge's hosted login page; an authenticated user sees the route's content. |
| Public routes | Any route you don't wrap in `<ProtectedRoute>` is public. |
| Router adapter | Bridge-driven redirects (the OAuth callback, the billing paywall) navigate through a `RouterAdapter`, so they use your router's client-side navigation instead of a full reload. |

> **Framework note:** bridge-react has no declarative route rule engine (a `RouteGuardConfig` with `rules`, `defaultAccess`, per-rule `featureFlag`, and `billing` gates). Auth protection is per-route with `<ProtectedRoute>`, which always starts the hosted login flow rather than redirecting to an in-app `loginRoute`. Flag gating is wired manually (below).

## Wiring up a router adapter

Register a router adapter once in your root component so Bridge redirects can use client-side navigation. Without one, Bridge falls back to `window.location`, which still works but forces a full reload.

```tsx
import { createReactRouterAdapter, setRouterAdapter } from '@nebulr-group/bridge-react';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function App() {
  const navigate = useNavigate();

  useEffect(() => {
    setRouterAdapter(createReactRouterAdapter(navigate));
  }, [navigate]);

  return <Routes>{/* ... */}</Routes>;
}
```

Pre-built adapters ship for the three most common routers; pick the one matching your app:

| Adapter | Router |
|---------|--------|
| `createReactRouterAdapter(navigate)` | React Router v6 (`useNavigate()`) |
| `createTanStackRouterAdapter(router)` | TanStack Router (`useRouter()`) |
| `createWouterAdapter(navigate)` | Wouter |

You can also implement `RouterAdapter` yourself (`navigate`, `replace`, `getCurrentPath`) for any other router, and call `setRouterAdapter()` with it.

## Gating a route behind a feature flag

Check the flag inside the route and redirect manually:

```tsx
import { useFlag } from '@nebulr-group/bridge-react/flags';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

function BetaRoute({ children }: { children: ReactNode }) {
  const { value } = useFlag('beta_feature', false);
  return value ? <>{children}</> : <Navigate to="/" replace />;
}
```

Wrap the flag-gated route in this component the same way you'd wrap it in `<ProtectedRoute>` (or nest both, if the route needs auth and a flag).

## Billing gates

Set `billing.paywallRoute` in the [config reference](/auth/config/#all-config-options) and `<BridgeProvider>` redirects an authenticated workspace that hasn't selected a plan there on load. Keep the paywall route itself public (outside `<ProtectedRoute>`'s hosted-login bounce) so the redirect target is reachable.

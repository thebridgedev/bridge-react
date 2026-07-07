---
title: Route guards
description: Frontend route protection for React.
sidebar:
  label: React
---

# Route guards

bridge-react is a pure client-side (CSR) plugin — there's no server middleware, and no equivalent to bridge-svelte's declarative `routeConfig` (`rules` / `defaultAccess` / feature-flag-gated redirects). Route protection is per-route: wrap `<BridgeProvider>` around your whole app once, then wrap any route element that needs auth in `<ProtectedRoute>`.

## Setup

```tsx
// src/main.tsx
import { BridgeProvider } from '@nebulr-group/bridge-react';

<BridgeProvider>
  <App />
</BridgeProvider>
```

## Protecting a route

```tsx
import { ProtectedRoute } from '@nebulr-group/bridge-react';
import { Routes, Route } from 'react-router-dom';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/auth/*" element={<AuthRoutes />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
```

`<ProtectedRoute>` reads `useAuth()`. While `isLoading` is true it renders a loading placeholder. Once loading resolves, if the user is **not** authenticated it immediately calls `login()` — a hard redirect to Bridge's hosted login — and renders nothing. If the user **is** authenticated, it renders `children`.

There's no in-app `loginRoute` fallback here: unlike bridge-svelte's guard, `<ProtectedRoute>` doesn't navigate to a local `/login` page first — it kicks off the hosted-login redirect directly. If you want an in-app login page instead, don't wrap that route in `<ProtectedRoute>`; build it with `<LoginForm />` (see [Email & password](/auth/ui/email-password/)) and gate access to it manually with `useAuth()`.

## Wiring up a router adapter

`<ProtectedRoute>` triggers a full-page redirect for login (via `window.location`), but other Bridge-driven redirects — the OAuth callback (`<CallbackHandler>`), the billing paywall redirect — go through a `RouterAdapter` so they can use your router's client-side navigation instead of a full page load. Without one, Bridge falls back to `window.location`, which still works but forces a full reload.

```tsx
import { useNavigate } from 'react-router-dom';
import { setRouterAdapter, createReactRouterAdapter } from '@nebulr-group/bridge-react';
import { useEffect } from 'react';

function App() {
  const navigate = useNavigate();

  useEffect(() => {
    setRouterAdapter(createReactRouterAdapter(navigate));
  }, [navigate]);

  return <Routes>{/* ... */}</Routes>;
}
```

Pre-built adapters ship for the three most common routers — pick the one matching your app:

| Adapter | Router |
|---------|--------|
| `createReactRouterAdapter(navigate)` | React Router v6 (`useNavigate()`) |
| `createTanStackRouterAdapter(router)` | TanStack Router (`useRouter()`) |
| `createWouterAdapter(navigate)` | Wouter |

You can also implement `RouterAdapter` yourself (`navigate`, `replace`, `getCurrentPath`) for any other router, and call `setRouterAdapter()` with it.

## Checking auth status

Use `useAuth()` to check whether the user is authenticated, without triggering a redirect:

```tsx
import { useAuth } from '@nebulr-group/bridge-react';

function NavBar() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <p>Loading...</p>;
  return isAuthenticated ? <UserMenu /> : <LoginButton />;
}
```

## Gating a route behind a feature flag

There's no declarative rule for this (unlike bridge-svelte's `{ match: '/beta/*', featureFlag: 'beta-feature', redirectTo: '/' }`) — check the flag yourself inside the route and redirect manually:

```tsx
import { useFlag } from '@nebulr-group/bridge-react/flags';
import { Navigate } from 'react-router-dom';

function BetaRoute({ children }: { children: React.ReactNode }) {
  const { value } = useFlag('beta-feature', false);
  return value ? <>{children}</> : <Navigate to="/" replace />;
}
```

Wrap the flag-gated route in this component the same way you'd wrap it in `<ProtectedRoute>` (or nest both, if the route needs both auth and a flag).

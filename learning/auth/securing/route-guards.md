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
  <BridgeProvider config={{ loginRoute: '/auth/login' }}>
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
import { BridgeAuthRoutes } from '@nebulr-group/bridge-react/react-router';
import { Route, Routes } from 'react-router-dom';

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      {/* every sign-in page, public */}
      <Route path="/auth/*" element={<BridgeAuthRoutes />} />
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
| `<ProtectedRoute>` | While auth state is loading it renders a loading placeholder. Once resolved, an unauthenticated user is sent to your `loginRoute` (or Bridge's hosted login page when it is unset); an authenticated user sees the route's content. |
| Public routes | Any route you don't wrap in `<ProtectedRoute>` is public. |
| Router adapter | Bridge-driven redirects (the OAuth callback, the billing paywall) navigate through a `RouterAdapter`, so they use your router's client-side navigation instead of a full reload. |

> **Framework note:** bridge-react has no declarative route rule engine (a `RouteGuardConfig` with `rules`, `defaultAccess`, per-rule `featureFlag`, and `billing` gates). Auth protection is per-route with `<ProtectedRoute>`. Flag gating is wired manually (below).

## Returning to the page they asked for

Someone who follows a link into a protected page — an emailed document link, a
bookmark, a shared URL — lands on that page after signing in, not on your
default route. This is on by default; you do not configure anything to get it.

How the target travels depends on which login you use:

| Mode | Mechanism | Your job |
|------|-----------|----------|
| **Hosted** (no `loginRoute`) | Held in `sessionStorage` across the OAuth round-trip | Nothing. `<CallbackHandler>` restores it |
| **SDK** (you set `loginRoute`) | `?redirectUri=` on your own login route | Read it after login — below |

### SDK mode: read it on your login page

Your login page owns the post-login navigation, so it has to read the target.
Use `readReturnTo` — it validates the value for you:

```tsx
import { LoginForm, readReturnTo } from '@nebulr-group/bridge-react';
import { useNavigate } from 'react-router-dom';

function LoginPage() {
  const navigate = useNavigate();

  return (
    <LoginForm
      onLogin={() => {
        // Falls back to your own default when there is no target, or when the
        // one supplied is not safe to navigate to.
        navigate(readReturnTo(window.location.search) ?? '/dashboard');
      }}
    />
  );
}
```

:::caution[Do not read the parameter yourself]
`?redirectUri=` arrives in the URL, so **whoever wrote the link controls it**.
Navigating to it unchecked is an open redirect: a link carrying
`?redirectUri=https://example.invalid` would bounce your users off-site, still
looking like it came from you. Phishing works well from there.

`readReturnTo` rejects anything that is not a same-origin path — absolute URLs,
protocol-relative `//host`, backslash variants, and control characters — and
returns `null` instead, which is why the `??` fallback above is all you need.
If you must handle the value yourself, run it through `sanitizeReturnTo` first.
:::

### Keeping auth routes out of it

Your `loginRoute` is excluded automatically, so a bounce through the login page
never comes back pointing at itself. Exclude the rest of your auth flow too:

```tsx
<BridgeProvider
  config={{
    appId: '…',
    loginRoute: '/auth/login',
    returnTo: { exclude: [new RegExp('^/auth($|/)')] },
  }}
>
```

### Turning it off

To send every login to the same place regardless of where the visitor was
heading:

```tsx
returnTo: { enabled: false }
```

A path that fails validation is treated the same way: your login page gets
`null` and falls back to its own default.

## Wiring up a router adapter

Bridge-driven redirects (the route guard, the OAuth callback, the billing paywall) use your router's client-side navigation once Bridge knows your router. Without that, Bridge falls back to `window.location`, which still works but forces a full reload.

The router adapter entries do it for you: `<BridgeAuthRoutes>` and `<BridgeBillingRoutes>` from `@nebulr-group/bridge-react/react-router` or `@nebulr-group/bridge-react/tanstack-router` register the router while mounted. An app that renders neither calls `useBridgeRouter()` from the same entry once, inside the router:

```tsx
import { useBridgeRouter } from '@nebulr-group/bridge-react/react-router';

function App() {
  useBridgeRouter();
  return <Routes>{/* ... */}</Routes>;
}
```

The router packages are optional peers (`react-router` 6.4 to 7, `@tanstack/react-router` 1): only the entry you import needs its router installed.

For any other router, the main entry still ships `createReactRouterAdapter`, `createTanStackRouterAdapter` and `createWouterAdapter`, or implement `RouterAdapter` yourself (`navigate`, `replace`, `getCurrentPath`), and call `setRouterAdapter()` with it.

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

`<BridgeProvider>` redirects an authenticated workspace that hasn't selected a plan to the paywall on load: `/subscription/plan` by default, served by `<BridgeBillingRoutes>` mounted at `/subscription/*` — only when the app has plans. Set `billing.paywallRoute` in the [config reference](/auth/config/#all-config-options) to move it (e.g. `/welcome` rendering `<BridgePaywallPage />`), or `false` to turn it off. A paywall route of your own must stay reachable for a signed-in, plan-less user.

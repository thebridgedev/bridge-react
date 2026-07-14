# Guard routes

bridge-react is a pure client-side (CSR) plugin — there's no server middleware, and no equivalent to bridge-svelte's declarative `routeConfig` with `featureFlag` route rules. You gate a route on a flag in the browser: evaluate the flag at the top of the route element and redirect (or render a fallback) when it's off.

## Gate a route with a flag

Wrap the flag-gated route in a small component that checks the flag and redirects when it doesn't pass:

```tsx
import { useFlag } from '@nebulr-group/bridge-react/flags';
import { Navigate } from 'react-router-dom';

function FlagRoute({ flag, children }: { flag: string; children: React.ReactNode }) {
  const { value } = useFlag(flag, false);
  return value ? <>{children}</> : <Navigate to="/upgrade" replace />;
}
```

```tsx
import { Routes, Route } from 'react-router-dom';

<Routes>
  <Route path="/" element={<Home />} />
  <Route
    path="/premium/*"
    element={
      <FlagRoute flag="premium-feature">
        <PremiumArea />
      </FlagRoute>
    }
  />
</Routes>
```

The flag evaluates against the same live rule cache as everywhere else, so an admin flipping `premium-feature` off redirects new navigations immediately — no redeploy.

## Combining with auth

A route that needs both a signed-in user *and* a flag nests the two guards — `<ProtectedRoute>` handles auth, `FlagRoute` handles the flag:

```tsx
<Route
  path="/beta/*"
  element={
    <ProtectedRoute>
      <FlagRoute flag="beta-feature">
        <BetaArea />
      </FlagRoute>
    </ProtectedRoute>
  }
/>
```

For an "any of these flags" gate (svelte's `featureFlag: { any: ['beta-feature', 'internal'] }`), read the flags you need and OR the values yourself:

```tsx
function BetaRoute({ children }: { children: React.ReactNode }) {
  const beta = useFlag('beta-feature', false);
  const internal = useFlag('internal', false);
  return beta.value || internal.value ? <>{children}</> : <Navigate to="/" replace />;
}
```

See [Route guards](/auth/securing/route-guards/) for the auth side and the router-adapter wiring.

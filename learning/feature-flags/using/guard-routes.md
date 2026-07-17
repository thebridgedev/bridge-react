# Guard routes

Gate entire routes behind flags so a visitor is redirected before the route
content renders.

> **Framework note:** bridge-react is a pure client-side plugin and has no
> declarative `routeConfig` route rules. You gate a route in the browser with
> a small guard component that evaluates the flag and redirects when it's off.

Wrap the flag-gated route in a guard component that checks the flag and
redirects when it doesn't pass (React Router shown; any router works the same
way):

```tsx
import { useFlag } from '@nebulr-group/bridge-react/flags';
import { Navigate } from 'react-router-dom';

function FlagRoute({ flag, redirectTo = '/', children }: {
  flag: string;
  redirectTo?: string;
  children: React.ReactNode;
}) {
  const { value } = useFlag(flag, false);
  return value ? <>{children}</> : <Navigate to={redirectTo} replace />;
}
```

```tsx
import { Routes, Route } from 'react-router-dom';

<Routes>
  <Route path="/" element={<Home />} />
  <Route
    path="/premium/*"
    element={
      <FlagRoute flag="premium-feature" redirectTo="/upgrade">
        <PremiumArea />
      </FlagRoute>
    }
  />
</Routes>
```

For an "any of these flags" gate, read the flags you need and OR the values:

```tsx
function BetaRoute({ children }: { children: React.ReactNode }) {
  const beta = useFlag('beta-feature', false);
  const internal = useFlag('internal', false);
  return beta.value || internal.value ? <>{children}</> : <Navigate to="/" replace />;
}
```

The guard evaluates against the same local flag cache the rest of the SDK
uses, so it runs on every navigation, before the route content renders, with
no extra setup: `<BridgeProvider>` warms that flag cache internally. Declare
the guard and it redirects when the flag is off. An admin flipping
`premium-feature` off redirects new navigations immediately, no redeploy.

Routes can also be guarded on authentication state by nesting the auth guard
around the flag guard; see [Route guards](/auth/securing/route-guards/) in the
Auth section for `<ProtectedRoute>` and the router-adapter wiring:

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

# @nebulr-group/bridge-react

Bridge for React: sign-in, plans and limits, feature flags and team management.

## Install

```bash
npm install @nebulr-group/bridge-react @nebulr-group/bridge-auth-core
```

## The whole integration

```env
VITE_BRIDGE_APP_ID=your-app-id
```

```tsx
// main.tsx
import { BridgeProvider } from '@nebulr-group/bridge-react';
import '@nebulr-group/bridge-react/styles';

<BridgeProvider config={{ loginRoute: '/auth/login' }}>
  <BrowserRouter><App /></BrowserRouter>
</BridgeProvider>
```

```tsx
// App.tsx — React Router
import { BridgeAuthRoutes, BridgeBillingRoutes } from '@nebulr-group/bridge-react/react-router';

<Route path="/auth/*" element={<BridgeAuthRoutes />} />
<Route path="/subscription/*" element={<BridgeBillingRoutes />} />
```

TanStack Router: import the same components from `@nebulr-group/bridge-react/tanstack-router` and mount them on `auth/$` and `subscription/$` routes. The routers are optional peer dependencies.

Options you pass win over `VITE_BRIDGE_*` / `REACT_APP_BRIDGE_*`, which win over the defaults. Take over any one page by passing an element (`pages={{ login: <MyLogin /> }}`); restyle everything with the `--bridge-*` CSS tokens.

## Docs

- How it fits together: `learning/mechanisms.md`
- Everything else: https://thebridge.dev/docs

MIT License © Nebulr Group

# Get started

`<BridgeProvider>` bootstraps flags automatically — mount it once at your app root and the flag runtime (rule cache, live updates, telemetry) comes up with it:

```tsx
// src/main.tsx
import { createRoot } from 'react-dom/client';
import { BridgeProvider } from '@nebulr-group/bridge-react';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <BridgeProvider appId="your-app-id">
    <App />
  </BridgeProvider>,
);
```

No flag-specific init call is needed — configuration comes from the same BridgeAuth config the provider already reads (only `appId` is required for flags-only apps). In a Vite app the provider picks it up from `VITE_BRIDGE_APP_ID`, so you can mount `<BridgeProvider>` with no props at all.

## Auth-free flags subpath

Need flags without pulling in the full auth runtime (e.g. a marketing page or a standalone widget)? Import from the `@nebulr-group/bridge-react/flags` subpath entry, which exposes the flag APIs (`useFlag`, `FeatureFlag`, `flagStore`, `getBridgeFlagsInstance`, `createBridgeFlags`, …) without the auth surface:

```tsx
import { useFlag } from '@nebulr-group/bridge-react/flags';
```

Everything on the main `@nebulr-group/bridge-react` entry is also available here, so the code in the rest of these guides works unchanged if you swap the import path.

Next: [Show or hide UI](/feature-flags/using/show-hide-ui/).

# Get started

Flags come with the SDK you already have: `<BridgeProvider>`
wires everything up for you (the rule
cache, live updates, and telemetry). There is no separate flags client to
create and no flag-specific init call.

## 1. Set up the SDK

Mount the provider once at your app root so the flags runtime is always loaded:

```tsx
// src/main.tsx
import { createRoot } from 'react-dom/client';
// <BridgeProvider> bootstraps flags for you: it attaches the rule cache,
// live updates, and telemetry when it mounts.
import { BridgeProvider } from '@nebulr-group/bridge-react';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <BridgeProvider appId="your-app-id">
    <App />
  </BridgeProvider>,
);
```

Configuration comes from the same `config` prop (or `VITE_BRIDGE_*` /
`REACT_APP_BRIDGE_*` environment variables) you already give
`<BridgeProvider>`. Only `appId` is required for flags-only
apps.

## 2. Create a flag in Control Center

In Control Center (your admin dashboard at app.thebridge.dev), open Feature
Flags and create a boolean flag, for example `show_banner`, and leave it off.

## 3. Read the flag in a component

```tsx
import { useFlag } from '@nebulr-group/bridge-react/flags';

function Banner() {
  const banner = useFlag('show_banner', false);

  if (!banner.value) return null;
  return <div className="banner">New stuff!</div>;
}
```

The second argument is the default: the value your app uses when the flag
isn't configured or Bridge is unreachable, so a flag check can never break
your app.

> **Framework note:** the flag surface is also re-exported from the main
> `@nebulr-group/bridge-react` entry; the `/flags` subpath is the same API
> without pulling in the rest of the package.

## 4. Flip it and watch it change live

With your app open in the browser, go back to Control Center and turn
`show_banner` on. The banner appears without a refresh, typically within
seconds: rule changes arrive over the live channel (a persistent realtime
connection the SDK maintains) and reactive reads like `useFlag` update in
place. Flip it off again and the banner disappears the same way.

That's the whole loop: create a flag, read it in code with a safe default,
and control it from Control Center from then on.

## Next steps

- [Show or hide UI](/feature-flags/using/show-hide-ui/) with the declarative `<FeatureFlag>` component
- [Use flags in your logic](/feature-flags/using/in-logic/) for branching code paths, not just markup
- [Guard routes](/feature-flags/using/guard-routes/) to gate whole pages behind a flag
- [Use flags on your backend](/feature-flags/using/backend/) so server and browser agree

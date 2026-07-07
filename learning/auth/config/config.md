---
title: Configurations
description: The BridgeConfig options you pass to BridgeProvider, and the app settings managed in Control Center.
sidebar:
  label: React
---

# Configurations

The config you pass to `<BridgeProvider>` controls how Bridge wires up auth and billing in your app — see [all config options](#all-config-options) for the full list.

## Passing configs to Bridge

Wrap your app once at the root (e.g. `src/main.tsx`) in `<BridgeProvider>`. The simplest form passes just an `appId`:

```tsx
// src/main.tsx
import { BridgeProvider } from '@nebulr-group/bridge-react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <BridgeProvider appId="your-app-id">
    <App />
  </BridgeProvider>
);
```

To set more than `appId`, pass a `config` object instead (or alongside — `appId` as a prop wins if both are given):

```tsx
import type { BridgeConfig } from '@nebulr-group/bridge-react';
import { BridgeProvider } from '@nebulr-group/bridge-react';

const config: BridgeConfig = {
  appId: import.meta.env.VITE_BRIDGE_APP_ID,
  debug: import.meta.env.DEV,
};

<BridgeProvider config={config}>
  <App />
</BridgeProvider>;
```

`<BridgeProvider>` initializes the Bridge runtime synchronously on the first client render (not inside a `useEffect`), and it's idempotent — a second provider instance in the tree reuses the existing singleton rather than re-initializing.

Configuration priority, highest to lowest: **environment variables** (`VITE_BRIDGE_*` / `REACT_APP_BRIDGE_*`) → the `config` / `appId` props → built-in defaults.

## Callback URL

`callbackUrl` is the URL Bridge calls back to once a login completes. If you omit it, it defaults to `${window.location.origin}/auth/oauth-callback`.

Passing a specific `callbackUrl` lets you send different parts of your app through different post-login destinations — for example, an admin section and a regular user section of the same app, or entirely separate apps sharing one Bridge project.

Whatever you pass here must already be registered as an allowed redirect URI in Control Center — see [Configs managed in Control Center](#configs-managed-in-control-center) — Bridge only redirects to callback URLs it's been told about.

```tsx
const config: BridgeConfig = {
  appId: import.meta.env.VITE_BRIDGE_APP_ID,
  callbackUrl: `${window.location.origin}/admin/oauth-callback`,
};
```

## All config options

| Option | Type | Default | Description |
|--------|------|---------|--------------|
| `appId` | `string` | — (required) | Your Bridge application ID |
| `callbackUrl` | `string` | `${origin}/auth/oauth-callback` | Where the login flow redirects back to after a successful login — see [Callback URL](#callback-url) |
| `debug` | `boolean` | `false` | Enable debug logging |
| `billing.paywallRoute` | `string` | — | Route to redirect an authenticated tenant to when it hasn't selected a plan yet. Checked once on mount; requires a `RouterAdapter` (or falls back to `window.location`) — see [Route guards](/auth/securing/route-guards/) |

These are the fields `<BridgeProvider>` itself reads and acts on. `BridgeConfig` also declares `defaultRedirectRoute`, `loginRoute`, `signupRoute`, `teamManagementUrl`, `cloudViewsUrl`, and `billing.paymentErrorRoute` for parity with the rest of the config surface, but bridge-react doesn't thread these through to app behavior centrally the way bridge-svelte's `bridgeBootstrap` + `RouteGuardConfig` does. Instead, each component that needs one of those routes takes it as its own explicit prop:

```tsx
<CallbackHandler
  successRoute="/dashboard"    // instead of a global defaultRedirectRoute
  loginRoute="/login"          // instead of a global loginRoute
  paymentErrorRoute="/billing/error"
/>
```

```tsx
<LoginForm signupHref="/signup" />   // instead of a global signupRoute
```

See [Route guards](/auth/securing/route-guards/) for why bridge-react handles routing this way — it's a pure client-side plugin with no server middleware or declarative route-rule engine.

The API base URL (`https://api.thebridge.dev` by default) isn't a settable prop today — override it with the `VITE_BRIDGE_API_BASE_URL` / `REACT_APP_BRIDGE_API_BASE_URL` environment variable if you need to point at a different environment.

## Passing values via .env

> **Tip:** this is just a best practice, not a requirement. Keep environment-specific values in a `.env` file instead of hardcoding them.

With Vite, the **`VITE_`** prefix is required for values to reach the browser:

```env
VITE_BRIDGE_APP_ID=your-app-id-here
VITE_BRIDGE_CALLBACK_URL=http://localhost:3000/auth/oauth-callback
VITE_BRIDGE_DEBUG=true
```

```tsx
// src/main.tsx — env vars still flow through the config prop for anything
// that isn't already picked up automatically (see priority order above).
const config: BridgeConfig = {
  debug: import.meta.env.DEV,
};

<BridgeProvider config={config}>
  <App />
</BridgeProvider>;
```

bridge-react also recognizes the **`REACT_APP_BRIDGE_*`** prefix for Create React App / webpack toolchains — use whichever prefix matches your bundler:

```env
REACT_APP_BRIDGE_APP_ID=your-app-id-here
REACT_APP_BRIDGE_CALLBACK_URL=http://localhost:3000/auth/oauth-callback
```

Unlike bridge-svelte, bridge-react reads `VITE_BRIDGE_APP_ID` / `REACT_APP_BRIDGE_APP_ID` (and the callback URL, debug flag, and API base URL) automatically at `<BridgeProvider>` init — you don't have to read `import.meta.env` yourself and pass every field through `config` by hand, though you still can if you'd rather keep config assembly explicit.

## Configs managed in Control Center

Some settings aren't passed in code at all — they're set once per app, and Bridge enforces them server-side:

| Setting | What it does |
|---------|---------------|
| Redirect URIs | The allowlist of callback URLs Bridge is allowed to redirect to. Any `callbackUrl` you pass must already be on this list. |
| Allowed origins | The CORS allowlist — origins permitted to call the Bridge API directly from the browser. |
| Default callback URL | Used whenever your app doesn't pass a `callbackUrl` in code — see [Callback URL](#callback-url). |

- **CLI:**

  ```bash
  bridge app update \
    --redirect-uris "https://app.example.com/oauth-callback,https://admin.example.com/oauth-callback" \
    --allowed-origins "https://app.example.com,https://admin.example.com" \
    --default-callback-uri "https://app.example.com/oauth-callback"
  ```

- **Control Center:** the same settings, managed from your app's settings.
- **MCP:** not yet available — coming soon.

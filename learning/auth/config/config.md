---
title: Configurations
description: The BridgeConfig options you pass to BridgeProvider, and the app settings managed in Control Center.
sidebar:
  label: React
---
import { Tabs, TabItem } from '@astrojs/starlight/components';

# Configurations

The config object you pass to `<BridgeProvider>` controls how Bridge wires up auth, routing, and billing in your app. See [all config options](#all-config-options) for the full list.

## Passing configs to Bridge

Wrap your app in `<BridgeProvider>` at the root (for example `src/main.tsx`), passing it a `BridgeConfig` object. The app ID comes from Control Center (your admin dashboard at app.thebridge.dev): open your app's settings and copy its ID into your `.env`.

```tsx
// src/main.tsx
import type { BridgeConfig } from '@nebulr-group/bridge-react';
import { BridgeProvider } from '@nebulr-group/bridge-react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

const config: BridgeConfig = {
  appId: import.meta.env.VITE_BRIDGE_APP_ID,
};

createRoot(document.getElementById('root')!).render(
  <BridgeProvider config={config}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </BridgeProvider>
);
```

Props:

```tsx
interface BridgeProviderProps {
  appId?: string;          // shorthand: just the appId as a string
  config?: BridgeConfig;   // full config object
  children: ReactNode;
}
```

Initialization is idempotent: rendering the provider again after it has completed is a no-op.

> **Framework note:** `<BridgeProvider>` also reads configuration from environment variables automatically (`VITE_BRIDGE_*` for Vite, `REACT_APP_BRIDGE_*` for Create React App). Priority, highest to lowest: environment variables, then props, then defaults.

## Callback URL

`callbackUrl` is the URL Bridge calls back to once a login completes. If you omit it, it defaults to `${window.location.origin}/auth/oauth-callback`.

Passing a specific `callbackUrl` lets you send different parts of your app through different post-login destinations, for example an admin section and a regular user section of the same app, or entirely separate apps sharing one Bridge project.

Whatever you pass here must already be registered as an allowed redirect URI in Control Center (see [Configs managed in Control Center](#configs-managed-in-control-center)); Bridge only redirects to callback URLs it's been told about.

```tsx
const config: BridgeConfig = {
  appId: import.meta.env.VITE_BRIDGE_APP_ID,
  callbackUrl: `${window.location.origin}/admin/oauth-callback`,
};
```

## Base URLs

One option points the SDK at Bridge itself. You only change it if you're on a dedicated or self-hosted Bridge environment; on the standard cloud, leave it alone.

- **`apiBaseUrl`** (default `https://api.thebridge.dev`): the base URL for the Bridge API. Every API endpoint the SDK calls is derived from it.

> **Framework note:** in bridge-react, `apiBaseUrl` is set via the `VITE_BRIDGE_API_BASE_URL` (or `REACT_APP_BRIDGE_API_BASE_URL`) environment variable rather than a `BridgeConfig` field. The hosted UI base URL (`hostedUrl` in other Bridge SDKs) is not configurable in bridge-react today.

## Login route

If you leave `loginRoute` unset, Bridge uses hosted auth: unauthenticated users who hit a protected route are redirected to Bridge's hosted login page. Unset is the default, so hosted login is what you get out of the box.

> **Framework note:** bridge-react's `<ProtectedRoute>` always starts the hosted login flow; it does not redirect to an in-app `loginRoute`. To use an in-app login page built with [`LoginForm`](/auth/ui/email-password/), leave that route public and link to it yourself. The `loginRoute` field is still declared on `BridgeConfig`, and `<CallbackHandler>` takes its own `loginRoute` prop as the error redirect.

## All config options

| Option | Type | Default | Description |
|--------|------|---------|--------------|
| `appId` | `string` | (required) | Your Bridge app ID, found in your app's settings in Control Center |
| `callbackUrl` | `string` | `${origin}/auth/oauth-callback` | Where the login flow redirects back to after a successful login. See [Callback URL](#callback-url) |
| `defaultRedirectRoute` | `string` | `'/'` | Route to redirect to after login |
| `loginRoute` | `string` | (unset) | In-app route of your login page. Not used for route protection in bridge-react; see [Login route](#login-route) |
| `billing.paywallRoute` | `string` | (none) | Route to redirect to when the workspace (called a *tenant* in the API) has no plan selected |
| `billing.paymentErrorRoute` | `string` | `'/payment-error'` | Route to redirect to when a Stripe checkout confirmation fails |
| `debug` | `boolean` | `false` | Enable debug logging |

## Passing values via .env

> **Tip:** this is just a best practice, not a requirement. Keep environment-specific values in a `.env` file instead of hardcoding them, and read them with Vite's `import.meta.env` when you build the config. The `VITE_` prefix is required for values to reach the browser.

> **Framework note:** bridge-react reads `VITE_BRIDGE_APP_ID`, `VITE_BRIDGE_API_BASE_URL`, `VITE_BRIDGE_CALLBACK_URL`, `VITE_BRIDGE_DEFAULT_REDIRECT_ROUTE`, `VITE_BRIDGE_LOGIN_ROUTE`, and `VITE_BRIDGE_DEBUG` automatically at provider init (plus the `REACT_APP_BRIDGE_*` equivalents), and environment variables take priority over props. You only build the config by hand for values without an env var, or if you prefer explicit config assembly.

<Tabs>
<TabItem label=".env">

```env
VITE_BRIDGE_APP_ID=your-app-id-here
VITE_BRIDGE_LOGIN_ROUTE=/auth/login
VITE_BRIDGE_DEFAULT_REDIRECT_ROUTE=/dashboard
```

</TabItem>
<TabItem label="main.tsx">

```tsx
const config: BridgeConfig = {
  appId: import.meta.env.VITE_BRIDGE_APP_ID,
  loginRoute: import.meta.env.VITE_BRIDGE_LOGIN_ROUTE,
  defaultRedirectRoute: import.meta.env.VITE_BRIDGE_DEFAULT_REDIRECT_ROUTE ?? '/',
  debug: import.meta.env.DEV,
};
```

</TabItem>
</Tabs>

## Configs managed in Control Center

Some settings aren't passed in code at all. They're set once per app, and Bridge enforces them server-side:

| Setting | What it does |
|---------|---------------|
| Redirect URIs | The allowlist of callback URLs Bridge is allowed to redirect to. Any `callbackUrl` you pass to `<BridgeProvider>` must already be on this list. |
| Allowed origins | The CORS allowlist: origins permitted to call the Bridge API directly from the browser. |
| Default callback URL | Used whenever your app doesn't pass a `callbackUrl` in code. See [Callback URL](#callback-url). |

- **CLI:**

  ```bash
  bridge app update \
    --redirect-uris "https://app.example.com/oauth-callback,https://admin.example.com/oauth-callback" \
    --allowed-origins "https://app.example.com,https://admin.example.com" \
    --default-callback-uri "https://app.example.com/oauth-callback"
  ```

- **Control Center:** the same settings, managed from your app's settings.
- **MCP (AI-assistant integration):** coming soon.

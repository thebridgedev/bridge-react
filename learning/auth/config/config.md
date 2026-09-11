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

Set `loginRoute` and `<ProtectedRoute>` sends unauthenticated users to that in-app route instead — SDK mode. Build the page with [`LoginForm`](/auth/ui/email-password/) and leave the route itself public. Either way the page they were heading for is remembered and restored after login; see [Route guards](/auth/securing/route-guards/#returning-to-the-page-they-asked-for).

`<CallbackHandler>` takes its own `loginRoute` prop, used as the error redirect.

## All config options

| Option | Type | Default | Description |
|--------|------|---------|--------------|
| `appId` | `string` | (required) | Your Bridge app ID, found in your app's settings in Control Center |
| `callbackUrl` | `string` | `${origin}/auth/oauth-callback` | Where the login flow redirects back to after a successful login. See [Callback URL](#callback-url) |
| `defaultRedirectRoute` | `string` | `'/'` | Route to redirect to after login |
| `loginRoute` | `string` | (unset) | In-app route of your login page. Set it for SDK mode; leave unset for hosted login. See [Login route](#login-route) |
| `locale` | `string` | `'en'` | UI language for the SDK auth components, e.g. `'sv'`. Region variants (`'sv-SE'`) resolve to their base language; an unknown locale falls back to English |
| `messages` | `MessageOverrides` | (none) | Per-key copy overrides applied on top of the locale. See [Translating the auth UI](#translating-the-auth-ui) |
| `returnTo.enabled` | `boolean` | `true` | Set `false` to send every login to `defaultRedirectRoute` regardless of where the visitor was heading |
| `returnTo.param` | `string` | `'redirectUri'` | Query parameter carrying the return target in SDK mode |
| `returnTo.exclude` | `(string \| RegExp)[]` | `[]` | Paths that must never become a return target. Your `loginRoute` is excluded automatically |
| `billing.paywallRoute` | `string` | (none) | Route to redirect to when the workspace (called a *tenant* in the API) has no plan selected |
| `billing.paymentErrorRoute` | `string` | `'/payment-error'` | Route to redirect to when a Stripe checkout confirmation fails |
| `debug` | `boolean` | `false` | Enable debug logging |

## Translating the auth UI

The SDK auth components ship their own copy — field labels, buttons, alerts,
success messages. Set `locale` once and all of it renders in that language:

```tsx
<BridgeProvider config={{ appId: '…', locale: 'sv' }}>
```

Bridge owns the **mechanics**: what a field is, what a button does, what went
wrong. Your app owns **voice and context**: the page title, the subtitle,
anything naming your product. Bridge cannot know those, which is why every
component takes `heading={null}` and `description={null}` so you can write your
own — see [Route guards](/auth/securing/route-guards/).

Shipping locales: **`en`** and **`sv`**. An unknown locale falls back to English
rather than throwing, and a key missing from a locale falls back to English —
a raw key like `login.submit` never renders.

For a phrase you need worded differently, override it per key:

```tsx
// app-wide
<BridgeProvider config={{ appId: '…', locale: 'sv', messages: { 'login.submit': 'Logga in nu' } }}>

// or one screen only
<LoginForm messages={{ 'login.heading': 'Welcome back' }} />
```

Precedence is component prop → config `messages` → `locale` → English. The
override path also covers any language Bridge does not ship yet.

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

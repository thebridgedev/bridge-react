# Quickstart

`@nebulr-group/bridge-react` puts The Bridge into a React app: sign-in, sign-up and password pages in your own app, workspaces, flags and route guards, plans and checkout, the team panel, and live updates. It needs one setting, the issuer.

This is the 1.0 alpha. It runs in the browser, works with React 18 and 19 and with any router, and signs people in with email and password, sign-in links and passkeys.

## 1. Install

```sh
npm install @nebulr-group/bridge-react@alpha
```

## 2. Set the issuer

Copy the issuer from your app's settings in Bridge into `.env`:

```sh
VITE_BRIDGE_ISSUER=https://…/identity-access/apps/<your app id>
```

The issuer must be an `https` address. Only on your own machine may it be `http://localhost`.

In your app's settings in Bridge, also add:

- your app's address (`https://app.example.com`, and `http://localhost:5173` while developing) as a **browser address**, so your pages may call Bridge;
- `https://app.example.com/auth` as the **email-links address**, so links in Bridge's emails (finishing sign-up, resetting a password, invites) land on your sign-in pages.

## 3. Wrap your routes

`<BridgeProvider>` goes around your routes, inside your router, so it can read the address and navigate through the router. With React Router:

```tsx
// src/main.tsx
import '@nebulr-group/bridge-react/styles';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
```

```tsx
// src/App.tsx
import { BridgeAuthRoutes, BridgeProvider, type BridgeConfig } from '@nebulr-group/bridge-react';
import { Route, Routes, useLocation, useNavigate } from 'react-router';

// Outside the component: a new object is a new configuration.
const config: BridgeConfig = {
  issuer: import.meta.env.VITE_BRIDGE_ISSUER,
  rules: [{ match: '/', public: true }],
};

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <BridgeProvider config={config} router={{ location, navigate: (to, options) => void navigate(to, options) }}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth/*" element={<BridgeAuthRoutes />} />
        {/* your other routes */}
      </Routes>
    </BridgeProvider>
  );
}
```

Every page is now protected except `/`, and `/auth/sign-in`, `/auth/sign-up` and the other sign-in pages work. A visitor who opens a protected page is sent to sign-in and comes back to it afterwards.

Without a `router`, the provider reads and moves the browser's history itself: fine for an app with no router library. With TanStack Router or Wouter, pass their location (`pathname`, `search`, `hash`) and navigate function the same way.

Links between your pages should go through your router or the plugin's `<Link href="/tickets">`: a plain `<a>` reloads the page, which with `storage: 'memory'` signs the tab out.

## Your API

React has no server side of its own. Your API checks the token each request carries (`bridgeFetch` adds it, see [Billing](../billing/billing.md)) with `@nebulr-group/bridge-auth-core/server`, or with The Bridge's Express or NestJS plugin.

## What to read next

- [Sign-in pages](../sign-in/sign-in.md): each page, the workspace choice, email links, sign-out, and the language.
- [Flags and route guards](../flags/flags.md): gating pages, links and buttons.
- [Billing](../billing/billing.md): plans, checkout, the portal, and plan limits.
- [The team panel](../team/team.md).
- [Live updates](../live-updates/live-updates.md).
- [Theming](../theming/theming.md): making Bridge's pages look like your app.
- [Hand-off mode](../handoff/handoff.md): a sign-in page for a command-line tool.

## All settings

```ts
const config: BridgeConfig = {
  issuer,                 // required: import.meta.env.VITE_BRIDGE_ISSUER
  rules,                  // route rules, first match wins
  defaultAccess,          // 'protected' (default) or 'public' for routes no rule matches
  auth: { base, afterSignIn, afterSignOut }, // '/auth', '/', the sign-in page
  returnToParam,          // 'redirectUri'
  locale, messages,       // the language, and your own wording
  tokenOrigins,           // other origins your API runs on, for bridgeFetch
  live,                   // true
  storage,                // 'local' (default) or 'memory': see below
  hints,                  // values flag rules may read, such as a country
  flags: { billingManage, teamManage, appActive }, // the flags Bridge's own screens gate on
  billing: { base, paywall, upgradeDialog },       // '/subscription', its plan page, true
  handoff,                // off; see Hand-off mode
  linkAddress,            // which email-links address Bridge's emails use, with several sign-in pages
  hosted,                 // sign in on the page Bridge hosts for the app instead of your own forms
};
```

`<BridgeProvider>` also takes `loading` (shown while the first navigation waits for Bridge) and `forbidden` (shown when a page's flag is off and its redirect is the page itself).

## Keeping the session out of the browser's storage

By default the session is kept in `localStorage`, so a reload and a new tab stay signed in. With `storage: 'memory'`, the session and the visitor id stay in the page's memory and are never written to `localStorage` or `sessionStorage`. A reload signs in again. A new tab is signed in by another open tab of the app, passed in memory only; with no other tab open, it signs in again.

```ts
const config: BridgeConfig = { issuer, storage: 'memory' };
```

A sign-up's email link opens in a new tab. In memory mode that tab hands the link to the tab that started the sign-up, which finishes there, and the new tab says to go on in the other window. If that tab was closed, the new tab finishes the sign-up itself: the sign-up's PKCE verifier is the one thing memory mode keeps in `localStorage`, for the link's 15 minutes at most, and it is removed once used. Opened on another device, the link says to open it where the sign-up started; it stays usable there.

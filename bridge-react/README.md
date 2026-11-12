<p align="center">
  <a href="https://thebridge.dev/?utm_source=npm&utm_medium=readme&utm_campaign=bridge-react"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/thebridgedev/bridge-react/main/.github/assets/banner.png"><img src="https://raw.githubusercontent.com/thebridgedev/bridge-react/main/.github/assets/banner-light.png" alt="The Bridge for React" width="100%"></picture></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@nebulr-group/bridge-react"><img src="https://img.shields.io/npm/v/@nebulr-group/bridge-react?color=20006b&label=npm" alt="npm version"></a>
  <a href="https://github.com/thebridgedev/bridge-react/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/@nebulr-group/bridge-react?color=20006b" alt="MIT license"></a>
</p>

<p align="center">
  <a href="https://thebridge.dev/?utm_source=npm&utm_medium=readme&utm_campaign=bridge-react"><b>Website</b></a> ·
  <a href="https://thebridge.dev/docs/quickstart/react/?utm_source=npm&utm_medium=readme&utm_campaign=bridge-react"><b>Quickstart</b></a> ·
  <a href="https://thebridge.dev/docs/?utm_source=npm&utm_medium=readme&utm_campaign=bridge-react"><b>Docs</b></a> ·
  <a href="https://thebridge.dev/docs/ai-assistants/mcp/?utm_source=npm&utm_medium=readme&utm_campaign=bridge-react"><b>Set up with your AI assistant</b></a>
</p>

# The Bridge for React

`@nebulr-group/bridge-react` adds sign-in in your own pages, workspaces, flag-based route guards, plans and checkout, the team panel and live updates to a React 18 or 19 app, with one `.env` line, a provider and two routes. It works with React Router, TanStack Router, Wouter or no router at all.

> **This is the 1.0 alpha**, built on `@nebulr-group/bridge-auth-core` 1.0 and the new Bridge API. It installs from the `alpha` tag; `latest` stays on 0.x until 1.0.0. It runs in the browser and signs people in with email and password, sign-in links and passkeys. Its components, props and settings match `@nebulr-group/bridge-svelte` 1.0.

**[The Bridge](https://thebridge.dev/?utm_source=npm&utm_medium=readme&utm_campaign=bridge-react)** is a hosted backend for SaaS apps: sign-in, multi-tenant workspaces, Stripe subscriptions with plan limits, and feature flags, managed from one dashboard.

## Install

```sh
npm install @nebulr-group/bridge-react@alpha
```

## The whole integration

```sh
# .env: the issuer from your app's settings in Bridge
VITE_BRIDGE_ISSUER=https://…/identity-access/apps/<your app id>
```

```tsx
// src/App.tsx, inside <BrowserRouter>; import '@nebulr-group/bridge-react/styles' once in main.tsx
import { BridgeAuthRoutes, BridgeProvider, type BridgeConfig } from '@nebulr-group/bridge-react';
import { Route, Routes, useLocation, useNavigate } from 'react-router';

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
      </Routes>
    </BridgeProvider>
  );
}
```

In your app's settings in Bridge, add your app's address as a browser address and `https://<your app>/auth` as its email-links address. See the [Quickstart](https://github.com/thebridgedev/bridge-react/blob/v1/learning/quickstart/quickstart.md).

## What it gives you

| Area | Pieces |
|---|---|
| Sign-in | `BridgeAuthRoutes` (sign-in, sign-up, verify-email, forgot-password, set-password, invite, workspaces, magic-link, passkey-setup, handoff, callback), `SignInForm`, `SignUpForm`, `VerifyEmail`, `ForgotPassword`, `SetPassword`, `InviteLanding`, `MagicLinkLanding`, `PasskeySetupLanding`, `PasskeyManager`, `WorkspaceChooser`, `SignOutButton`, `ProfileName` |
| Gates | route `rules`, `FeatureFlag`, `useFlag`, `requireFlag`, the paywall: all on flag results, never a role or the plan |
| Billing | `BridgeBillingRoutes`, `PlanPicker`, `BillingPortalButton`, `SubscriptionStatus`, `BillingNotice`, `QuotaBanner`, `CheckoutNotice`, `UpgradeDialog`, `useQuota`, `bridgeFetch` |
| Team | `TeamPanel`, `MemberList`, `InviteDialog`, `InviteList`, `EditMemberDialog`, `ConfirmDialog`, `WorkspaceForm`, `ProfileForm` |
| State | `useSession`, `useUser`, `useWorkspace`, `useWorkspaces`, `useMe`, `useFlags`, `useBilling`, `usePlans`, `useUsage`, `useLiveStatus`, `getBridge()` |
| Hand-off | `HandoffSignIn`, `readHandoff`, `handoffSignIn`: a sign-in page for a command-line tool |
| Hosted mode | `hosted: {}` in the config: `/auth/sign-in` sends people to the page Bridge hosts for the app, and `/auth/callback` (`HostedCallback`) finishes the sign-in when they come back. Register the page's origin as a browser address and `https://<your app>/auth/callback` as a sign-in return |
| Several sign-in pages | `linkAddress` in the config: which of the app's registered email-links addresses its emails link to |

There is no server side in this package: your API checks tokens with `@nebulr-group/bridge-auth-core/server`, or with The Bridge's Express or NestJS plugin.

All the guides: [the learning docs](https://github.com/thebridgedev/bridge-react/tree/v1/learning).

## License

[MIT](https://github.com/thebridgedev/bridge-react/blob/main/LICENSE) © Nebulr. Built by [The Bridge](https://thebridge.dev/?utm_source=npm&utm_medium=readme&utm_campaign=bridge-react).

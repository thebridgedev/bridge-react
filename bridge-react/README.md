<p align="center">
  <a href="https://thebridge.dev/?utm_source=npm&utm_medium=readme&utm_campaign=bridge-react"><img src="https://raw.githubusercontent.com/thebridgedev/bridge-react/main/.github/assets/banner.png" alt="The Bridge for React" width="100%"></a>
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

`@nebulr-group/bridge-react` adds sign-in, workspaces and roles, feature flags, Stripe subscriptions and plan limits to a React app, with React Router or TanStack Router.

**[The Bridge](https://thebridge.dev/?utm_source=npm&utm_medium=readme&utm_campaign=bridge-react)** is a hosted backend for SaaS apps. It gives you sign-in (passwords, magic links, passkeys, social login and SSO), multi-tenant workspaces with roles, Stripe subscriptions with plan limits, and feature flags, all managed from one dashboard. Your AI coding assistant can set it up for you through the [Bridge MCP server](https://thebridge.dev/docs/ai-assistants/mcp/?utm_source=npm&utm_medium=readme&utm_campaign=bridge-react).

> **Let your AI assistant set it up.** Connect the [Bridge MCP server](https://thebridge.dev/docs/ai-assistants/mcp/?utm_source=npm&utm_medium=readme&utm_campaign=bridge-react) to Claude, Cursor, Copilot or Gemini CLI and ask it to add Bridge to your app. Not using MCP? Run `npx @nebulr-group/bridge-cli guide add-login` in your project: it detects your framework from `package.json` and prints the steps for your assistant to follow. `npx @nebulr-group/bridge-cli doctor` checks the result.

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

How the pieces fit together: [How Bridge works](https://github.com/thebridgedev/bridge-react/blob/main/learning/mechanisms.md).

## Learn more

- [Quickstart](https://thebridge.dev/docs/quickstart/react/?utm_source=npm&utm_medium=readme&utm_campaign=bridge-react)
- [Authentication](https://thebridge.dev/docs/auth/react/?utm_source=npm&utm_medium=readme&utm_campaign=bridge-react)
- [Sign-in inside your app](https://thebridge.dev/docs/sdk-auth/react/?utm_source=npm&utm_medium=readme&utm_campaign=bridge-react)
- [Feature flags](https://thebridge.dev/docs/feature-flags/react/?utm_source=npm&utm_medium=readme&utm_campaign=bridge-react)
- [Branding](https://thebridge.dev/docs/branding/react/?utm_source=npm&utm_medium=readme&utm_campaign=bridge-react)
- [Live updates](https://thebridge.dev/docs/live-updates/react/?utm_source=npm&utm_medium=readme&utm_campaign=bridge-react)
- [Subscriptions and plan limits](https://thebridge.dev/docs/billing/how-it-works/?utm_source=npm&utm_medium=readme&utm_campaign=bridge-react)

## Other Bridge packages

| Package | For |
|---|---|
| [`@nebulr-group/bridge-svelte`](https://www.npmjs.com/package/@nebulr-group/bridge-svelte) | SvelteKit |
| [`@nebulr-group/bridge-nextjs`](https://www.npmjs.com/package/@nebulr-group/bridge-nextjs) | Next.js |
| [`@nebulr-group/bridge-angular`](https://www.npmjs.com/package/@nebulr-group/bridge-angular) | Angular |
| [`@nebulr-group/bridge-nestjs`](https://www.npmjs.com/package/@nebulr-group/bridge-nestjs) | NestJS |
| [`@nebulr-group/bridge-express`](https://www.npmjs.com/package/@nebulr-group/bridge-express) | Express |
| [`@nebulr-group/bridge-cli`](https://www.npmjs.com/package/@nebulr-group/bridge-cli) | CLI for people and AI agents |
| [`@nebulr-group/bridge-auth-core`](https://www.npmjs.com/package/@nebulr-group/bridge-auth-core) | Any JavaScript app (core) |

## License

[MIT](https://github.com/thebridgedev/bridge-react/blob/main/LICENSE) © Nebulr. Built by [The Bridge](https://thebridge.dev/?utm_source=npm&utm_medium=readme&utm_campaign=bridge-react).

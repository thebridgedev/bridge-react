## Bridge React Library & Demo Documentation

This repository contains the Bridge React library (`@nebulr-group/bridge-react`) and a demo application showcasing its features.

### Quick Links
- [Quickstart Guide](learning/quickstart/quickstart.md) – Get started quickly with Bridge in your React app
- [Examples](learning/examples/examples.md) – Detailed examples of Bridge features

### Table of Contents
- [Installation](#installation)
- [Configuration](#configuration)
- [Authentication](#authentication)
- [Feature Flags](#feature-flags)
- [Demo Application](#demo-application)
- [E2E Tests](#e2e-tests)
- [Publishing & Release](#publishing--release)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
bun add @nebulr-group/bridge-react
# or
npm install @nebulr-group/bridge-react
```

## Configuration

The whole integration, with React Router. Every page Bridge needs, it serves.

```env
# .env — a production app needs only the first line
VITE_BRIDGE_APP_ID=your-app-id
VITE_BRIDGE_API_BASE_URL=https://api-stage.thebridge.dev   # stage / local only
```

```tsx
// main.tsx
import { BridgeProvider } from '@nebulr-group/bridge-react';
import '@nebulr-group/bridge-react/styles';

createRoot(document.getElementById('root')!).render(
  <BridgeProvider config={{ loginRoute: '/auth/login' }}>
    <BrowserRouter><App /></BrowserRouter>
  </BridgeProvider>
);
```

```tsx
// App.tsx
import { BridgeAuthRoutes, BridgeBillingRoutes } from '@nebulr-group/bridge-react/react-router';

<Routes>
  <Route path="/auth/*" element={<BridgeAuthRoutes />} />                {/* every sign-in page */}
  <Route path="/subscription/*" element={<BridgeBillingRoutes />} />     {/* plans, paywall, checkout returns */}
  …your routes…
</Routes>
```

TanStack Router: `createRoute({ getParentRoute: () => rootRoute, path: 'auth/$', component: BridgeAuthRoutes })` with the components from `@nebulr-group/bridge-react/tanstack-router`. Both routers are optional peer dependencies; install only the one you use. Without a router, `<BridgeAuthRoutes base="/auth" />` reads `window.location`.

**Settings resolve as explicit option > environment > default.** An empty variable counts as unset.

| Vite | Create React App | When to set it |
|---|---|---|
| `VITE_BRIDGE_APP_ID` | `REACT_APP_BRIDGE_APP_ID` | Always. Missing, Bridge refuses to start and names the variable |
| `VITE_BRIDGE_API_BASE_URL` | `REACT_APP_BRIDGE_API_BASE_URL` | Only for a non-production app. Unset means production |
| `VITE_BRIDGE_HOSTED_URL` | `REACT_APP_BRIDGE_HOSTED_URL` | Only for a local or self-hosted Bridge; on Bridge's domains it follows the API address |
| `VITE_BRIDGE_DEBUG` | `REACT_APP_BRIDGE_DEBUG` | `true` for console logging |

`callbackUrl`, `defaultRedirectRoute` and `loginRoute` can also come from `…_BRIDGE_CALLBACK_URL`, `…_BRIDGE_DEFAULT_REDIRECT_ROUTE` and `…_BRIDGE_LOGIN_ROUTE`. Everything else (`billing`, `locale`, `messages`, `returnTo`, `devBadge`) is set on the `config` prop.

Customising Bridge's pages, lowest rung first: `--bridge-*` CSS tokens; `frame(page, children)` and `heading(page)` render props; taking over one page by passing an element (`<BridgeAuthRoutes pages={{ login: <MyLogin /> }} />`); or headless on `getBridgeAuth()`. Plan limits need no page code: a `402 QUOTA_EXCEEDED` from your backend opens the upgrade dialog `<BridgeProvider>` mounts; `<QuotaGate metric>` and `useQuota(metric)` are the next two levels. The rules are on one page: [learning/mechanisms.md](learning/mechanisms.md).

## Authentication

See:
- Quickstart – authentication: `learning/quickstart/quickstart.md#authentication`
- Examples – authentication: `learning/examples/examples.md#authentication`

The library provides:
- Login and logout helpers
- Protected route patterns
- Automatic token renewal
- Access to user profile information

## Feature Flags

See:
- Examples – Feature Flags: `learning/examples/examples.md#feature-flags`

Supported patterns:
- Client-side flag checks and conditional rendering
- Negation for inverse conditions
- Cached vs live flag checks
- Route protection using flags

## Demo Application

The demo app contains runnable examples mirroring the docs.

```bash
# From repo root
bun install
bun run dev
```

The demo showcases:
- Feature flags
- Team management
- Authentication flows
- Payment and subscription patterns
- Integration examples

## E2E Tests

E2E tests use Playwright. Run them from the repo root.

1. **Configure env:** Copy `config/.env.test.local.example` to `config/.env.test.local` and fill in the values (test data API key, etc.).
2. **Pre-setup:** The first step of `test:e2e` runs a pre-setup script that creates/gets the test app and writes `VITE_BRIDGE_APP_ID` into `demo/.env.test.local` so the demo starts with the correct app.
3. **Install browsers (once):** `bunx playwright install`
4. **Run tests:**
   - `bun run test:e2e` — local (starts demo on port 3001, runs Playwright)
   - `bun run test:e2e:stage` — stage
   - `bun run test:e2e:prod` — prod
   - `bun run test:e2e:headed` — local with browser visible
   - `bun run test:e2e:report` — open last HTML report

## Publishing & Release

Bridge React is published to npm via GitHub Actions.

### Releasing a new version
1. Update the version in `bridge-react/bridge-react/package.json`
2. Commit and push your changes
3. Create a PR and merge into `main`
4. Tag the release using semantic versioning (`vX.Y.Z`):

```bash
git tag v0.1.0
git push origin v0.1.0
```

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

Licensed under the MIT License. See `LICENSE` for details.

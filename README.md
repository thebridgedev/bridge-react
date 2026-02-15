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

Wrap your application with the `BridgeProvider`. Configuration can be supplied via props or environment variables.

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BridgeProvider } from '@nebulr-group/bridge-react';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BridgeProvider
    config={{
      appId: 'your_app_id',
      callbackUrl: 'http://localhost:5173/auth/oauth-callback',
      defaultRedirectRoute: '/protected',
      debug: true
    }}
  >
    <App />
  </BridgeProvider>
);
```

You can also configure through environment variables (recommended):

```env
# Vite
VITE_BRIDGE_APP_ID=your-app-id
VITE_BRIDGE_CALLBACK_URL=http://localhost:5173/auth/oauth-callback
VITE_BRIDGE_DEFAULT_REDIRECT_ROUTE=/protected
VITE_BRIDGE_AUTH_BASE_URL=https://api.thebridge.dev/auth
VITE_BRIDGE_TEAM_MANAGEMENT_URL=https://api.thebridge.dev/cloud-views/user-management-portal/users
VITE_BRIDGE_CLOUD_VIEWS_URL=https://api.thebridge.dev/cloud-views
VITE_BRIDGE_DEBUG=true

# Create React App
REACT_APP_BRIDGE_APP_ID=your-app-id
REACT_APP_BRIDGE_CALLBACK_URL=http://localhost:3000/auth/oauth-callback
REACT_APP_BRIDGE_DEFAULT_REDIRECT_ROUTE=/protected
REACT_APP_BRIDGE_AUTH_BASE_URL=https://api.thebridge.dev/auth
REACT_APP_BRIDGE_TEAM_MANAGEMENT_URL=https://api.thebridge.dev/cloud-views/user-management-portal/users
REACT_APP_BRIDGE_CLOUD_VIEWS_URL=https://api.thebridge.dev/cloud-views
REACT_APP_BRIDGE_DEBUG=true
```

### Essential Configuration
- **appId** (required string): Your application ID from the Bridge dashboard.
- **callbackUrl** (string): URL Bridge redirects to after authentication. Default: `origin + '/auth/oauth-callback'`.
- **defaultRedirectRoute** (string): Route to redirect users after successful login. Default: `'/'`.
- **debug** (boolean): Enable verbose SDK logs. Default: `false`.

### Advanced Configuration
- **authBaseUrl** (string): Bridge auth service base URL. Default: `https://api.thebridge.dev/auth`.
- **loginRoute** (string): App login route used for unauthenticated redirects. Default: `'/login'`.
- **teamManagementUrl** (string): Team management portal URL. Default: `https://api.thebridge.dev/cloud-views/user-management-portal/users`.
- **cloudViewsUrl** (string): Base URL for Bridge cloud-views (feature flags, plan selection, payments). Default: `https://api.thebridge.dev/cloud-views`.

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

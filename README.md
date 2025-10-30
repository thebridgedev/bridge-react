# @nebulr-group/bridge-react

Modern authentication, feature flags, and team management for React applications.

> **Status**: 🚧 In Development - See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for details

---

## Overview

`bridge-react` is a pure React plugin that provides:
- 🔐 **Authentication** - Login, logout, protected routes, automatic token refresh
- 🚦 **Feature Flags** - Client-side conditional rendering based on feature flags
- 👥 **Team Management** - Integrated user and team management portal
- 💳 **Subscription Management** - Subscription and plan selection
- ⚡ **Lightweight** - ~23KB minified, no heavy dependencies
- 🎯 **TypeScript-first** - Full type safety
- 📱 **Router Agnostic** - Works with any React router or no router at all

---

## Project Status

This plugin is currently in the **planning and development phase**.

### Implementation Strategy

We are building this plugin based on `@bridge-nextjs` (Strategy A) rather than `@nblocks-react` because:

- ✅ **85% code reusability** from bridge-nextjs
- ✅ **Modern architecture** with Zustand state management
- ✅ **Self-contained** - no external SDK dependencies
- ✅ **Better security** - hybrid token storage approach
- ✅ **Cleaner API** - better developer experience
- ✅ **3-5 days** estimated development time

### What's Different from @bridge-nextjs?

`@bridge-nextjs` is designed for Next.js applications with server-side capabilities. `@bridge-react` is designed for **any React application**:

- ❌ **Removed**: Server-side components, Next.js middleware, server utilities
- ✅ **Added**: Router adapter system for any React router
- ✅ **Adapted**: Pure client-side token management (localStorage)
- ✅ **Added**: Subscription management component

---

## Planned Features

### Components
- `<BridgeProvider>` - Main provider wrapping your app
- `<Login>` - Login button/redirect component
- `<ProtectedRoute>` - Protect routes from unauthenticated access
- `<FeatureFlag>` - Conditionally render based on feature flags
- `<Team>` - Embedded team management portal
- `<Subscription>` - Subscription/plan selection redirect
- `<TokenStatus>` - Debug component showing token information

### Hooks
- `useAuth()` - Authentication state and methods (login, logout, isAuthenticated)
- `useFeatureFlag(flagName)` - Check if a feature flag is enabled
- `useProfile()` - Access user profile information
- `useTeamManagement()` - Get team management URL
- `useBridgeConfig()` - Access bridge configuration
- `useBridgeToken()` - Low-level token access (advanced usage)

---

## Quick Start (Planned)

```bash
npm install @nebulr-group/bridge-react
```

### Basic Setup

```tsx
import { BridgeProvider } from '@nebulr-group/bridge-react';

function App() {
  return (
    <BridgeProvider appId="your-app-id">
      <YourApp />
    </BridgeProvider>
  );
}
```

### Authentication

```tsx
import { Login, ProtectedRoute, useAuth } from '@nebulr-group/bridge-react';

function LoginPage() {
  return <Login />;
}

function Dashboard() {
  const { isAuthenticated, logout } = useAuth();
  
  return (
    <div>
      <h1>Dashboard</h1>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

function App() {
  return (
    <ProtectedRoute redirectTo="/login">
      <Dashboard />
    </ProtectedRoute>
  );
}
```

### Feature Flags

```tsx
import { FeatureFlag, useFeatureFlag } from '@nebulr-group/bridge-react';

function MyComponent() {
  // Declarative approach
  return (
    <FeatureFlag flagName="new-feature">
      <NewFeatureComponent />
    </FeatureFlag>
  );
}

function AnotherComponent() {
  // Programmatic approach
  const isEnabled = useFeatureFlag('premium-features');
  
  return (
    <div>
      {isEnabled ? <PremiumFeatures /> : <BasicFeatures />}
    </div>
  );
}
```

### Team Management

```tsx
import { Team } from '@nebulr-group/bridge-react';

function TeamPage() {
  return (
    <div style={{ height: '100vh' }}>
      <Team />
    </div>
  );
}
```

---

## Router Integration (Planned)

### With React Router

```tsx
import { BridgeProvider, setRouterAdapter } from '@nebulr-group/bridge-react';
import { useNavigate } from 'react-router-dom';

function App() {
  const navigate = useNavigate();
  
  // Set custom router adapter
  React.useEffect(() => {
    setRouterAdapter({
      navigate: (path, options) => navigate(path, { replace: options?.replace }),
      replace: (path) => navigate(path, { replace: true }),
      getCurrentPath: () => window.location.pathname
    });
  }, [navigate]);
  
  return (
    <BridgeProvider appId="your-app-id">
      <YourApp />
    </BridgeProvider>
  );
}
```

### Without Router (Default)

The plugin works out of the box without any router. It uses `window.location` by default.

```tsx
import { BridgeProvider } from '@nebulr-group/bridge-react';

// No router setup needed!
function App() {
  return (
    <BridgeProvider appId="your-app-id">
      <YourApp />
    </BridgeProvider>
  );
}
```

---

## Configuration (Planned)

### Via Props

```tsx
<BridgeProvider 
  appId="your-app-id"
  authBaseUrl="https://auth.nblocks.cloud"
  defaultRedirectRoute="/dashboard"
  debug={true}
>
  <App />
</BridgeProvider>
```

### Via Environment Variables

For Create React App:
```bash
REACT_APP_BRIDGE_APP_ID=your-app-id
REACT_APP_BRIDGE_AUTH_BASE_URL=https://auth.nblocks.cloud
REACT_APP_BRIDGE_DEBUG=true
```

For Vite:
```bash
VITE_BRIDGE_APP_ID=your-app-id
VITE_BRIDGE_AUTH_BASE_URL=https://auth.nblocks.cloud
VITE_BRIDGE_DEBUG=true
```

---

## Migration from @nblocks-react

If you're currently using `@nblocks-react`, the migration will be straightforward:

### Key Changes

1. **Provider**: `NblocksProvider` → `BridgeProvider`
2. **Components**: Remove `Component` suffix (e.g., `LoginComponent` → `Login`)
3. **Hooks**: Simplified API (e.g., `useTokens()` → `useAuth()`)
4. **No SDK**: Direct API integration (no `@nebulr-group/nblocks-ts-client` needed)
5. **State**: Zustand instead of React Context (better performance)

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for detailed migration guide.

---

## Architecture

### Dependencies

```json
{
  "dependencies": {
    "jwt-decode": "^4.0.0",    // JWT parsing (6KB)
    "zustand": "^4.5.0",       // State management (2.9KB)
    "jose": "^6.0.10"          // JWT verification (14KB)
  }
}
```

**Total**: ~23KB minified

### Structure

```
src/
├── components/         # React components
├── hooks/             # React hooks
├── providers/         # Context providers
├── services/          # Service layer (auth, tokens, feature flags, etc.)
├── types/             # TypeScript types
├── utils/             # Utilities (router adapters)
└── index.ts           # Main exports
```

---

## Development

### Setup

```bash
git clone <repository>
cd bridge-react
npm install
```

### Build

```bash
npm run build        # Production build
npm run build:watch  # Watch mode
```

### Testing

```bash
npm test             # Run tests
npm run test:watch   # Watch mode
```

---

## Documentation

- [Implementation Plan](./IMPLEMENTATION_PLAN.md) - Detailed development roadmap
- [API Reference](./docs/API.md) - Complete API documentation (coming soon)
- [Examples](./examples/) - Example applications (coming soon)
- [Migration Guide](./docs/MIGRATION.md) - Migrating from nblocks-react (coming soon)

---

## Support Matrix

| React Version | Supported |
|--------------|-----------|
| 18.x | ✅ Yes |
| 17.x | ✅ Yes |
| 16.14+ | ✅ Yes |

| Router | Supported | Notes |
|--------|-----------|-------|
| No Router | ✅ Yes | Default adapter |
| React Router v6 | ✅ Yes | Custom adapter needed |
| TanStack Router | ✅ Yes | Custom adapter needed |
| Wouter | ✅ Yes | Custom adapter needed |
| Any other | ✅ Yes | Implement RouterAdapter interface |

---

## Roadmap

### Phase 1: Core (Week 1)
- [x] Planning and architecture
- [ ] Project setup and configuration
- [ ] Copy and adapt bridge-nextjs code
- [ ] Router abstraction layer
- [ ] Token storage adaptation

### Phase 2: Features (Week 1-2)
- [ ] All authentication features
- [ ] Feature flags
- [ ] Team management
- [ ] Subscription management
- [ ] Build system setup

### Phase 3: Polish (Week 2)
- [ ] Documentation
- [ ] Example applications
- [ ] Testing
- [ ] TypeScript refinements

### Phase 4: Release (Week 3)
- [ ] Alpha release
- [ ] Beta testing
- [ ] Stable release

---

## Contributing

This project is currently in active development. Contributions will be welcome once we reach beta.

---

## License

MIT License - Copyright (c) 2025 Nebulr Group

---

## Related Projects

- [@nebulr-group/bridge-nextjs](https://github.com/nebulr-group/bridge-nextjs) - bridge for Next.js
- [@nebulr-group/nblocks-react](https://npmjs.com/package/@nebulr-group/nblocks-react) - Legacy React plugin

---

## Questions?

For detailed technical planning, see [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)

**Project Status**: Planning Phase  
**Estimated Delivery**: Week 1-2 of November 2025  
**Confidence**: High (Strategy validated through comprehensive analysis)


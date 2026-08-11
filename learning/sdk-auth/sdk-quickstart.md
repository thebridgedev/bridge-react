# SDK auth quickstart

> This guide covers in-app SDK auth components. For the simplest setup using Bridge's hosted login page, see the [Hosted auth quickstart](../quickstart/hosted-quickstart.md).

Get up and running with The Bridge React plugin using in-app SDK auth components, with no redirects to external login pages.

## 1. Install the plugin

```bash
npm i @nebulr-group/bridge-react
```

## 2. Configuration (`src/main.tsx`)

Initialize Bridge by wrapping your app in `<BridgeProvider>` at the root. The `BridgeConfig` object tells Bridge your `appId`. Import the plugin's stylesheet here too so the auth forms render styled.

```tsx
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { BridgeProvider, type BridgeConfig } from '@nebulr-group/bridge-react';
import '@nebulr-group/bridge-react/styles';
import App from './App';

const config: BridgeConfig = {
  appId: import.meta.env.VITE_BRIDGE_APP_ID,
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BridgeProvider config={config}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </BridgeProvider>
  </StrictMode>,
);
```

Key points:
- **`<BridgeProvider>` sits above the router**: it mounts the Bridge runtime once for the whole app.
- **Client-side rendering**: Bridge requires client-side rendering; a standard Vite + React SPA needs no extra configuration.

## 3. Protect your routes (`src/App.tsx`)

Register a router adapter once so Bridge can navigate with your router, and guard the routes that require a signed-in user with a small component that redirects to your in-app login page:

```tsx
// src/App.tsx
import { useAuth, setRouterAdapter } from '@nebulr-group/bridge-react';
import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return isAuthenticated ? <>{children}</> : <Navigate to="/auth/login" replace />;
}

function App() {
  const navigate = useNavigate();

  useEffect(() => {
    setRouterAdapter({
      navigate: (path, options) => navigate(path, { replace: options?.replace }),
      replace: (path) => navigate(path, { replace: true }),
      getCurrentPath: () => window.location.pathname,
    });
  }, [navigate]);

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<HomePage />} />
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/signup" element={<SignupPage />} />

      {/* Everything below requires auth */}
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
    </Routes>
  );
}

export default App;
```

> **Framework note:** bridge-react has no declarative `routeConfig` route
> rules; you decide which routes are public and which require authentication
> in your router, with `useAuth()` supplying the reactive auth state.

## 4. Create a login page

Drop the `LoginForm` component onto the page your login route renders.

```tsx
// src/pages/LoginPage.tsx
import { LoginForm } from '@nebulr-group/bridge-react';

export default function LoginPage() {
  return (
    <div className="login-page">
      <LoginForm showSignupLink />
    </div>
  );
}
```

```css
/* Optional: center the form on the page. Not required for the component to work. */
.login-page {
  display: flex;
  justify-content: center;
  padding: 3rem 1rem;
}
```

That's it: no callbacks needed. Auth method visibility (magic link, passkeys, SSO) is derived from your app's configuration in the Control Center (your admin dashboard at app.thebridge.dev).

`LoginForm` handles multi-step flows inline: forgot password, magic link requests, passkey login, MFA challenge, MFA setup, and workspace selection (a workspace is called a *tenant* in the API) all render within the same component automatically when needed.

**Optional props:** `onLogin` (fires after successful auth, useful for analytics or a post-login redirect), `onError` (fires on auth failure).

## 5. Create a signup page

```tsx
// src/pages/SignupPage.tsx
import { SignupForm } from '@nebulr-group/bridge-react';

export default function SignupPage() {
  return (
    <div className="signup-page">
      <SignupForm showLoginLink loginHref="/auth/login" />
    </div>
  );
}
```

```css
/* Optional: center the form on the page. */
.signup-page {
  display: flex;
  justify-content: center;
  padding: 3rem 1rem;
}
```

After a successful signup the user receives a verification email. Once verified, they can sign in.

**Optional props:** `onSignup` (fires after successful signup), `onError` (fires on failure).

## 6. Styles

See [Theming & Styles](../theming/theming.md) for customization options.

## 7. Configuration

The `config` object you pass to `<BridgeProvider>` is a `BridgeConfig`. The most common fields:

| Field | Default | Description |
|-------|---------|-------------|
| `appId` | **(required)** | Your Bridge app ID |
| `callbackUrl` | `<origin>/auth/oauth-callback` | Where hosted-auth redirects land (unused in a pure SDK-auth setup) |
| `defaultRedirectRoute` | `'/'` | Route to land on after login |
| `debug` | `false` | Enable debug logging |

See the [Configuration reference](/auth/config/) for the full list (token storage, billing routes).

Rather than hardcoding environment-specific values, keep them in a `.env` file. `<BridgeProvider>` reads `VITE_BRIDGE_*` (Vite) and `REACT_APP_BRIDGE_*` (Create React App) environment variables automatically, and they take priority over props:

```env
VITE_BRIDGE_APP_ID=your-app-id-here
VITE_BRIDGE_DEFAULT_REDIRECT_ROUTE=/dashboard
```

```tsx
// With env vars in place, the provider needs no config at all:
<BridgeProvider>
  <App />
</BridgeProvider>
```

## Next steps

- **More auth UI components**: [MFA](/auth/ui/mfa/), [passkeys](/auth/ui/passkeys/), [magic link](/auth/ui/magic-link/), [SSO login button](/auth/ui/google-sso/), [switching workspaces](/auth/ui/switching-workspaces/), and [user & team management](/auth/ui/team-management/).
- **The user token**: [logging in and logging out](/auth/user-token/logging-in-and-out/), [getting the token](/auth/user-token/getting-the-token/), and [auth states](/auth/user-token/auth-states/).
- **Route protection**: [frontend route guards](/auth/securing/route-guards/), or browse the full [Auth](/auth/) section.
- **Feature flags and billing**: [how flags work](/feature-flags/how-it-works/) and [how billing works](/billing/how-it-works/).

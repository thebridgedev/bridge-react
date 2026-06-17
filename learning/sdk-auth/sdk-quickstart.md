# SDK Auth Quickstart

Render authentication UI directly inside your app — no redirect to bridge hosted auth.

## Prerequisites

- The hosted-quickstart integration steps are complete.
- The Bridge app has **`tenantSelfSignup: true`** enabled (required for the signup flow).
- Enable the auth methods you want (Password, Magic Link, Passkeys, SSO providers).
- The plugin ships structural CSS — import it once in your app entry:

  ```tsx
  import '@nebulr-group/bridge-react/styles';
  ```

## Install

```bash
bun add @nebulr-group/bridge-react @nebulr-group/bridge-auth-core
```

(bridge-react is a Vite / React app — use bun.)

## Pages

These are plain React components registered with your router (react-router shown below).
Keep the paths identical so the public auth flow links line up.

### `/auth/login`

```tsx
import { LoginForm } from '@nebulr-group/bridge-react';
import { useNavigate } from 'react-router-dom';

function SdkLoginPage() {
  const navigate = useNavigate();
  return <LoginForm heading="Sign in" onLogin={() => navigate('/')} />;
}

export default SdkLoginPage;
```

`<LoginForm>` handles MFA, tenant selection, and the magic-link callback automatically. It reads the anonymous app config and only shows enabled auth methods.

### `/auth/signup`

```tsx
import { SignupForm } from '@nebulr-group/bridge-react';
import { useNavigate } from 'react-router-dom';

function SdkSignupPage() {
  const navigate = useNavigate();
  return <SignupForm onSignup={() => navigate('/auth/login')} />;
}

export default SdkSignupPage;
```

### Magic link / forgot password / set password / passkey setup

| Route | Component |
|---|---|
| `/auth/magic-link` | `<MagicLink />` |
| `/auth/forgot-password` | `<ForgotPassword />` |
| `/auth/set-password/:token` | `<ForgotPassword token={token} />` |
| `/auth/setup-passkey/:token` | `<PasskeySetup token={token} />` |

For the token routes, read the param with react-router's `useParams`:

```tsx
import { ForgotPassword } from '@nebulr-group/bridge-react';
import { useParams } from 'react-router-dom';

function SdkSetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  return <ForgotPassword token={token} />;
}

export default SdkSetPasswordPage;
```

### Register the routes

The SDK auth pages are public — register them outside any `<ProtectedRoute>`:

```tsx
<Route path="/auth/login" element={<SdkLoginPage />} />
<Route path="/auth/signup" element={<SdkSignupPage />} />
<Route path="/auth/magic-link" element={<SdkMagicLinkPage />} />
<Route path="/auth/forgot-password" element={<SdkForgotPasswordPage />} />
<Route path="/auth/set-password/:token" element={<SdkSetPasswordPage />} />
<Route path="/auth/setup-passkey/:token" element={<SdkSetupPasskeyPage />} />
```

## App config

The plugin reads the anonymous app config (called on mount) to know:
- Which SSO providers are enabled.
- Whether passwords / magic links / passkeys are available.
- Whether signup is allowed.

Toggles in the Bridge admin UI propagate to the `<LoginForm>` automatically.

## Environment variables

bridge-react is a Vite app — the app id is provided via a `VITE_`-prefixed env var:

```bash
VITE_BRIDGE_APP_ID=your-app-id
```

## Customizing

Override props on `<LoginForm>`:

```tsx
<LoginForm
  showSignupLink={false}
  showMagicLink={false}
  showPasskeys={true}
  ssoConnections={[{ id: 'google', type: 'google', name: 'Google' }]}
  forgotPasswordHref="/help/reset-password"
/>
```

## Custom heading or footer

```tsx
<LoginForm
  heading="Welcome back to MyApp"
  footer={<p>By signing in you agree to our <a href="/terms">terms</a>.</p>}
/>
```

## See also

- [Auth state and hooks](../auth/auth.md)
- [Payments](../payments/payments.md)

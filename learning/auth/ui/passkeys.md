# Passkeys

Passkey (WebAuthn) authentication lets users sign in with a biometric or device
credential instead of a password. Requires `@simplewebauthn/browser` as a peer
dependency.

## PasskeyLogin

A button that triggers passkey authentication via the browser's WebAuthn API.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onLogin` | `() => void` | — | Called after successful passkey login |
| `onError` | `(error: Error) => void` | — | Called on error |
| `onSetupPasskey` | `() => void` | — | Called when the user has no passkey and needs to set one up instead |
| `setupHref` | `string` | — | Fallback navigation target when the user has no passkey and `onSetupPasskey` isn't provided |
| `label` | `string` | `'Continue with passkey'` | Button label |

```tsx
import { PasskeyLogin } from '@nebulr-group/bridge-react';
import { useNavigate } from 'react-router-dom';

function LoginPage() {
  const navigate = useNavigate();
  return (
    <PasskeyLogin
      onLogin={() => navigate('/dashboard')}
      onError={(err) => console.error(err)}
    />
  );
}
```

## PasskeySetup

Registers a new passkey using a setup token (emailed to the user).

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `token` | `string` | **(required)** | The setup token from the URL |
| `onComplete` | `() => void` | — | Called after passkey registration |
| `onError` | `(error: Error) => void` | — | Called on error |
| `loginHref` | `string` | `'/auth/login'` | Link shown once registration is done |

```tsx
// src/routes/auth/passkey-setup.tsx
import { useSearchParams } from 'react-router-dom';
import { PasskeySetup } from '@nebulr-group/bridge-react';

export function PasskeySetupPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  return <PasskeySetup token={token} onComplete={() => console.log('Passkey set up')} />;
}
```

## PasskeyRequestSetupLink

An email form that requests a passkey setup link be sent to the user.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialEmail` | `string` | `''` | Pre-filled email address |
| `onSent` | `() => void` | — | Called after the setup-link email is sent |
| `onError` | `(error: Error) => void` | — | Called on error |
| `onBack` | `() => void` | — | Called when user clicks back (renders a button instead of a plain link) |
| `loginHref` | `string` | `'/auth/login'` | Link back to the login page, used when `onBack` isn't provided |

```tsx
import { PasskeyRequestSetupLink } from '@nebulr-group/bridge-react';

<PasskeyRequestSetupLink
  initialEmail="user@example.com"
  onSent={() => console.log('Setup link sent')}
/>
```

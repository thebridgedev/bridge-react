# Passkeys

Passkey (WebAuthn) authentication lets users sign in with a biometric or device
credential instead of a password.

## PasskeyLogin

A button that triggers passkey authentication via the browser's WebAuthn API.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onLogin` | `() => void` | (none) | Called after successful passkey login |
| `onError` | `(error: Error) => void` | (none) | Called on error |
| `onSetupPasskey` | `() => void` | (none) | Called when the user wants to set up a passkey instead |
| `setupHref` | `string` | (none) | Route of your passkey setup page; used when `onSetupPasskey` isn't provided |
| `label` | `string` | `'Continue with passkey'` | Button label text |

```tsx
import { PasskeyLogin } from '@nebulr-group/bridge-react';
import { useNavigate } from 'react-router-dom';

function PasskeyButton() {
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
| `onComplete` | `() => void` | (none) | Called after passkey registration |
| `onError` | `(error: Error) => void` | (none) | Called on error |
| `loginHref` | `string` | `'/auth/login'` | Link back to the login page |

```tsx
// src/pages/SetupPasskeyPage.tsx (rendered at /auth/setup-passkey/:token)
import { PasskeySetup } from '@nebulr-group/bridge-react';
import { useNavigate, useParams } from 'react-router-dom';

function SetupPasskeyPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  return (
    <PasskeySetup
      token={token ?? ''}
      onComplete={() => navigate('/auth/login')}
    />
  );
}
```

## PasskeyRequestSetupLink

An email form that requests a passkey setup link be sent to the user.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `initialEmail` | `string` | `''` | Pre-filled email address |
| `onSent` | `() => void` | (none) | Called after the setup link email is sent |
| `onError` | `(error: Error) => void` | (none) | Called on error |
| `onBack` | `() => void` | (none) | Called when user clicks back |
| `loginHref` | `string` | `'/auth/login'` | Link back to the login page |

```tsx
import { PasskeyRequestSetupLink } from '@nebulr-group/bridge-react';

<PasskeyRequestSetupLink
  initialEmail="user@example.com"
  onBack={() => console.log('Back to login')}
/>
```

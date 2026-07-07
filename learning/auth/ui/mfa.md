# MFA / 2FA

## MfaChallenge

Prompts the user to enter an MFA code. Appears automatically inside `LoginForm` when `authState` transitions to `'mfa-required'`. Can also be used standalone.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onVerified` | `() => void` | — | Called after successful MFA verification |
| `onError` | `(error: Error) => void` | — | Called on verification error |
| `showRecoveryOption` | `boolean` | `true` | Show the recovery code toggle |

The component supports two modes:
1. **Auth code** — the user enters a 6-digit code from their authenticator app.
2. **Recovery code** — the user enters a backup recovery code.

**Standalone usage:**

```tsx
import { MfaChallenge, useBridgeStore } from '@nebulr-group/bridge-react';
import { useNavigate } from 'react-router-dom';

function CustomLoginFlow() {
  const authState = useBridgeStore((s) => s.authState);
  const navigate = useNavigate();

  if (authState !== 'mfa-required') return null;

  return (
    <MfaChallenge
      onVerified={() => navigate('/dashboard')}
      onError={(err) => console.error(err)}
    />
  );
}
```

## MfaSetup

Guides the user through a 3-step MFA setup flow: enter phone number, verify code, save backup codes. Appears automatically inside `LoginForm` when `authState` transitions to `'mfa-setup-required'`.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onComplete` | `() => void` | — | Called after MFA setup is complete |
| `onError` | `(error: Error) => void` | — | Called on setup error |

**Standalone usage:**

```tsx
import { MfaSetup, useBridgeStore } from '@nebulr-group/bridge-react';
import { useNavigate } from 'react-router-dom';

function CustomLoginFlow() {
  const authState = useBridgeStore((s) => s.authState);
  const navigate = useNavigate();

  if (authState !== 'mfa-setup-required') return null;

  return (
    <MfaSetup
      onComplete={() => navigate('/dashboard')}
      onError={(err) => console.error(err)}
    />
  );
}
```

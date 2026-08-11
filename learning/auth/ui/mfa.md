# MFA / 2FA

Bridge's MFA is SMS-based: codes are 6-digit one-time codes texted to the phone number the user enrolls during setup, with a recovery code as backup. Two components cover the flow.

## MfaChallenge

Prompts the user to enter an MFA code. Appears automatically inside `LoginForm` when `authState` transitions to `'mfa-required'`. Can also be used standalone.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onVerified` | `() => void` | (none) | Called after successful MFA verification |
| `onError` | `(error: Error) => void` | (none) | Called on verification error |
| `showRecoveryOption` | `boolean` | `true` | Show the recovery code toggle |

The component supports two modes:
1. **Authentication code**: the user enters the 6-digit code texted to their enrolled phone number, with a resend option (60-second cooldown).
2. **Recovery code**: the user enters the recovery code they saved during setup instead, for example after losing their phone.

**Standalone usage:**

```tsx
import { MfaChallenge, useAuth } from '@nebulr-group/bridge-react';
import { useNavigate } from 'react-router-dom';

function MfaStep() {
  const { authState } = useAuth();
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

Guides the user through a 3-step MFA setup flow: enter a phone number, verify the 6-digit code texted to it, then save the one-time recovery code. Appears automatically inside `LoginForm` when `authState` transitions to `'mfa-setup-required'`.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onComplete` | `() => void` | (none) | Called after MFA setup is complete |
| `onError` | `(error: Error) => void` | (none) | Called on setup error |

**Standalone usage:**

```tsx
import { MfaSetup, useAuth } from '@nebulr-group/bridge-react';
import { useNavigate } from 'react-router-dom';

function MfaSetupStep() {
  const { authState } = useAuth();
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

To turn MFA on for your app in the first place, see [MFA / 2FA](/auth/sign-in/mfa/) under Sign-in methods.

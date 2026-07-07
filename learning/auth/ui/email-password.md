---
title: Email & password
description: Bridge email & password login for React.
sidebar:
  label: React
---

# Email & password

A complete login form with email/password fields. Handles multi-step auth flows inline: forgot password, magic link, passkey login, MFA challenge, MFA setup, and tenant selection all appear automatically within the same component when the auth state requires them.

**Usage:**

```tsx
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '@nebulr-group/bridge-react';

function LoginPage() {
  const navigate = useNavigate();

  return (
    <LoginForm
      showSignupLink
      signupHref="/auth/signup"
      showForgotPassword
      showMagicLink
      showPasskeys
      onLogin={() => navigate('/dashboard')}
      onError={(err) => console.error(err)}
    />
  );
}
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `showSignupLink` | `boolean` | auto (`appConfig.signupEnabled`, else `true`) | Show a link to the signup page |
| `signupHref` | `string` | `'/auth/signup'` | Signup page URL |
| `showForgotPassword` | `boolean` | `true` | Show the forgot password link |
| `forgotPasswordHref` | `string` | `'/auth/forgot-password'` | Reserved for API parity — the forgot-password step always renders inline regardless of this prop |
| `showMagicLink` | `boolean` | auto (`appConfig.magicLinkEnabled`, else `false`) | Show the magic link login option |
| `magicLinkHref` | `string` | `'/auth/magic-link'` | href for the magic link button |
| `showPasskeys` | `boolean` | auto (`appConfig.passkeysEnabled`, else `false`) | Show the passkey login button |
| `passkeySetupHref` | `string` | `'/auth/setup-passkey'` | Where `PasskeyLogin` sends the user when they have no passkey registered yet |
| `onLogin` | `() => void` | — | Called after successful login (all steps complete) |
| `onError` | `(error: Error) => void` | — | Called on any login error |
| `onSsoClick` | `(connectionType: string) => void` | — | Called when an SSO button is clicked |
| `heading` | `string` | `''` | Custom heading text |
| `ssoConnections` | `FederationConnection[]` | `[]` | SSO connections to display. Auto-derived from app config if not set |
| `ssoMode` | `'redirect' \| 'popup'` | `'redirect'` | SSO kickoff strategy for the built-in buttons. See [SSO mode](/auth/ui/google-sso/#sso-mode-redirect-vs-popup). Ignored when `onSsoClick` is provided. |
| `footer` | `ReactNode` | — | Custom footer content |

**Auth state transitions:** After a successful email/password login, `LoginForm` checks the resulting auth state. If MFA is required, it automatically shows `MfaChallenge`. If MFA setup is required, it shows `MfaSetup`. If tenant selection is needed (multi-tenant user), it shows `TenantSelector`. The `onLogin` callback fires only after all steps are complete and the user is fully authenticated.

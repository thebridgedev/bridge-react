---
title: Email & password
description: Bridge email & password login for React.
sidebar:
  label: React
---

# Email & password

A complete login form with email/password fields. Handles multi-step auth flows inline: forgot password, passkey login, MFA challenge, MFA setup, and workspace selection all appear automatically within the same component when the auth state requires them.

> **Framework note:** in bridge-react, the magic link option is a link to a separate page (default `/auth/magic-link`, set with `magicLinkHref`) where you render the [`MagicLink`](/auth/ui/magic-link/) component, rather than an inline step.

**Usage:**

```tsx
import { LoginForm } from '@nebulr-group/bridge-react';
import { useNavigate } from 'react-router-dom';

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
| `showSignupLink` | `boolean` | auto (from app config) | Show a link to the signup page |
| `signupHref` | `string` | `'/auth/signup'` | Signup page URL |
| `showForgotPassword` | `boolean` | `true` | Show the forgot password link |
| `showMagicLink` | `boolean` | auto (from app config) | Show the magic link login option |
| `magicLinkHref` | `string` | `'/auth/magic-link'` | Route of your magic link request page; the magic link option links here |
| `showPasskeys` | `boolean` | auto (from app config) | Show the passkey login button |
| `passkeySetupHref` | `string` | `'/auth/setup-passkey'` | Route of your passkey setup page, offered when the user has no passkey yet |
| `onLogin` | `() => void` | (none) | Called after successful login (all steps complete) |
| `onError` | `(error: Error) => void` | (none) | Called on any login error |
| `onSsoClick` | `(connectionType: string) => void` | (none) | Called when an SSO button is clicked |
| `heading` | `string` | `''` | Custom heading text |
| `ssoConnections` | `FederationConnection[]` | `[]` | SSO connections to display (a federation connection is an SSO identity provider configured for your app, e.g. Google or Azure AD). Auto-derived from app config if not set |
| `ssoMode` | `'redirect' \| 'popup'` | `'redirect'` | SSO kickoff strategy for the built-in buttons. See [SSO mode](/auth/ui/google-sso/#sso-mode-redirect-vs-popup). Ignored when `onSsoClick` is provided. |
| `footer` | `ReactNode` | (none) | Custom footer content |

**Auth state transitions:** After a successful email/password login, the `LoginForm` checks the resulting auth state. If MFA is required, it automatically shows `MfaChallenge`. If MFA setup is required, it shows `MfaSetup`. If workspace selection is needed (multi-workspace user), it shows `TenantSelector`. The `onLogin` callback fires only after all steps are complete and the user is fully authenticated.

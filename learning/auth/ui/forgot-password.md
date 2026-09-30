# Forgot / reset password

Dual-mode component:
1. **Request mode** (no `token` prop): shows an email form to request a password reset link.
2. **Reset mode** (`token` prop set): shows a new password form to complete the reset.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `token` | `string` | (none) | Reset token from URL. When set, shows the new password form |
| `onComplete` | `() => void` | (none) | Called after the email is sent (request mode) or password is reset (reset mode) |
| `onError` | `(error: Error) => void` | (none) | Called on error |
| `loginHref` | `string` | `'/auth/login'` | Link back to the login page |

> **You may not need this page.** `<BridgeAuthRoutes>` mounted at `/auth/*` already serves `/auth/forgot-password` and `/auth/set-password/<token>` (where signup verification and password-reset emails land). Write your own only to take that page over, and hand it to Bridge by element: `<BridgeAuthRoutes pages={{ 'forgot-password': <ForgotPasswordPage /> }} />`. For the set-password page, pass a function to receive the emailed token: `pages={{ 'set-password': ({ token }) => <ForgotPassword token={token} /> }}`.

**Request page:**

```tsx
// src/pages/ForgotPasswordPage.tsx (rendered at /auth/forgot-password)
import { ForgotPassword } from '@nebulr-group/bridge-react';

function ForgotPasswordPage() {
  return (
    <ForgotPassword
      loginHref="/auth/login"
      onComplete={() => console.log('Reset email sent')}
    />
  );
}
```

**Reset page (with token from URL):**

```tsx
// src/pages/SetPasswordPage.tsx (rendered at /auth/set-password/:token)
import { ForgotPassword } from '@nebulr-group/bridge-react';
import { useNavigate, useParams } from 'react-router-dom';

function SetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  return (
    <ForgotPassword
      token={token ?? ''}
      loginHref="/auth/login"
      onComplete={() => navigate('/auth/login')}
    />
  );
}
```

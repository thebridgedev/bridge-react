# Forgot / reset password

Dual-mode component:
1. **Request mode** (no `token` prop) — shows an email form to request a password reset link.
2. **Reset mode** (`token` prop set) — shows a new password form to complete the reset.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `token` | `string` | — | Reset token from URL. When set, shows the new password form |
| `onComplete` | `() => void` | — | Called after the email is sent (request mode) or password is reset (reset mode) |
| `onError` | `(error: Error) => void` | — | Called on error |
| `loginHref` | `string` | `'/auth/login'` | Link back to the login page |

**Request page:**

```tsx
// src/routes/auth/forgot-password.tsx
import { ForgotPassword } from '@nebulr-group/bridge-react';

export function ForgotPasswordPage() {
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
// src/routes/auth/reset-password.tsx
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ForgotPassword } from '@nebulr-group/bridge-react';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  return (
    <ForgotPassword
      token={token}
      loginHref="/auth/login"
      onComplete={() => navigate('/auth/login')}
    />
  );
}
```

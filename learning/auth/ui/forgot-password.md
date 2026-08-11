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

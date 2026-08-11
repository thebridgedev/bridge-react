# Signup

A signup form with email, first name, and last name fields. There is no password step here: the user activates the account through the verification email, then signs in with whichever method your app enables.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onSignup` | `() => void` | (none) | Called after successful signup |
| `onError` | `(error: Error) => void` | (none) | Called on signup error |
| `showLoginLink` | `boolean` | `true` | Show a link to the login page |
| `loginHref` | `string` | `'/auth/login'` | Login page URL |
| `heading` | `string` | `'Create your account'` | Custom heading text |
| `footer` | `ReactNode` | (none) | Custom footer content |

**Usage:**

```tsx
import { SignupForm } from '@nebulr-group/bridge-react';
import { useNavigate } from 'react-router-dom';

function SignupPage() {
  const navigate = useNavigate();

  return (
    <SignupForm
      showLoginLink
      loginHref="/auth/login"
      onSignup={() => navigate('/auth/login')}
      onError={(err) => console.error(err)}
    />
  );
}
```

After signup, the user receives a verification email. Once verified, they can sign in.

> **Tip:** `LoginForm`'s signup link points to `/auth/signup` by default; if your signup page lives elsewhere, override it with `LoginForm`'s `signupHref` prop. See [Email & password](/auth/ui/email-password/).

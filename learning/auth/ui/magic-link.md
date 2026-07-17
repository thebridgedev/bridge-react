# Magic link

Standalone magic link request form. When a user clicks a magic link from their email, the token is in the URL and `LoginForm` processes it automatically.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onSent` | `() => void` | (none) | Called after the magic link email is sent |
| `onError` | `(error: Error) => void` | (none) | Called on error |
| `loginHref` | `string` | `'/auth/login'` | Link back to the login page |

**Usage:**

```tsx
// src/pages/MagicLinkPage.tsx (rendered at /auth/magic-link)
import { MagicLink } from '@nebulr-group/bridge-react';

function MagicLinkPage() {
  return (
    <MagicLink
      loginHref="/auth/login"
      onSent={() => console.log('Check your email!')}
      onError={(err) => console.error(err)}
    />
  );
}
```

When the user clicks the link in their email, they are brought to your app. The token URL parameter is auto-handled by `LoginForm`.

> **Framework note:** the landing page must render `LoginForm`, which detects the `bridge_magic_link_token` URL parameter and completes authentication; no extra wiring is needed on that page.

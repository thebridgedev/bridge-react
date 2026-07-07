# Magic link

Standalone magic link request form. When a user clicks a magic link from their email, `LoginForm` picks up the `bridge_magic_link_token` URL parameter automatically and completes authentication — no extra wiring needed on that landing page as long as it renders `LoginForm`.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onSent` | `() => void` | — | Called after the magic link email is sent |
| `onError` | `(error: Error) => void` | — | Called on error |
| `loginHref` | `string` | `'/auth/login'` | Link back to the login page |

**Usage:**

```tsx
// src/routes/auth/magic-link.tsx
import { MagicLink } from '@nebulr-group/bridge-react';

export function MagicLinkPage() {
  return (
    <MagicLink
      loginHref="/auth/login"
      onSent={() => console.log('Check your email!')}
      onError={(err) => console.error(err)}
    />
  );
}
```

When the user clicks the link in their email, they land back on your app with `?bridge_magic_link_token=...` in the URL. `LoginForm` detects and consumes that token automatically on mount — make sure the route the link points at renders `LoginForm`.

# Magic link

Standalone magic link request form. It also redeems the link: the emailed link returns to the page the request was made from, and this component reads the token out of the URL on mount.

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

When the user clicks the link in their email, they land back on the route they requested it from — `/auth/magic-link` in the example above — with a `bridge_magic_link_token` query parameter. `MagicLink` redeems that token on mount, strips it from the URL and signs the user in; `LoginForm` does the same, so either component works as the landing page. Keep that route reachable to signed-out users.

> **Framework note:** because bridge-react sends users to a separate magic link page rather than an inline step, that page is where the link comes back to. Rendering `MagicLink` on it is all the wiring it needs. To point the email at a different page, pass `successUrl` to `sendMagicLink`; the URL must be one of your app's allowed origins. See [Magic link](/auth/sign-in/magic-link/#where-the-link-comes-back) in sign-in methods.

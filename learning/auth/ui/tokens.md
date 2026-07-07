# Tokens

A drop-in component for managing API tokens. Renders a complete token management UI.

**Usage:**

```tsx
// src/routes/settings/api-tokens.tsx
import { ApiTokenManagement } from '@nebulr-group/bridge-react';

export function ApiTokensPage() {
  return <ApiTokenManagement className="my-token-panel" />;
}
```

The component provides:
- List of existing API tokens
- Create new tokens with a privilege picker (searchable)
- Revoke tokens with confirmation
- Display a new token value once after creation (show/hide/copy)
- Token expiry date display

No additional props are required. Standard `HTMLAttributes<HTMLDivElement>` props (`className`, `style`, etc.) are forwarded to the root element.

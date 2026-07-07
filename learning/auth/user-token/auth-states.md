---
title: Auth states
description: Every state a signed-in (or signing-in) user can be in, and how to branch on it.
sidebar:
  label: React
---

# Auth states

`authState` is a single reactive value that tells you exactly where a user is in the login flow — from "not signed in" through any in-progress step, to fully authenticated. It's what drives `LoginForm`'s multi-step behavior (MFA, tenant selection, etc.) automatically, and you can read the same value yourself — via `useAuth()` or `useBridgeStore(s => s.authState)` — to build custom flows.

## The states

| State | Meaning |
|-------|---------|
| `'unauthenticated'` | No valid tokens — the user isn't signed in |
| `'credentials-validated'` | Email/password (or equivalent) passed; Bridge is deciding whether MFA or tenant selection is needed next |
| `'mfa-required'` | An MFA code challenge is pending |
| `'mfa-setup-required'` | The user must set up MFA before continuing (first-time enrollment) |
| `'tenant-selection'` | The user has access to more than one workspace and needs to pick one |
| `'authenticated'` | Fully signed in with valid tokens — the user can use the app |

Any state returns to `'unauthenticated'` on logout or if the tokens are cleared.

## Branching on it yourself

`LoginForm` handles all of this internally, so you only need this if you're building a custom login screen instead of using the drop-in component:

```tsx
import { useBridgeStore, MfaChallenge, MfaSetup, TenantSelector } from '@nebulr-group/bridge-react';

function CustomLoginFlow() {
  const authState = useBridgeStore((s) => s.authState);

  switch (authState) {
    case 'unauthenticated':
      return <p>Please sign in.</p>;
    case 'credentials-validated':
      return <p>Checking your account…</p>;
    case 'mfa-required':
      return <MfaChallenge onVerified={() => {}} />;
    case 'mfa-setup-required':
      return <MfaSetup onComplete={() => {}} />;
    case 'tenant-selection':
      return <TenantSelector />;
    case 'authenticated':
      return <p>You're in.</p>;
    default:
      return null;
  }
}
```

`authState` is also available from `useAuth().authState`, alongside the derived `isAuthenticated` / `isLoading` booleans, so you don't always need to reach for `useBridgeStore` directly.

## Checking just "am I logged in"

For the common case — gating a route or showing/hiding a nav item — you don't need the full state machine, just whether it resolved to `'authenticated'`. `useAuth()` covers that:

```tsx
import { useAuth } from '@nebulr-group/bridge-react';

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <p>Loading...</p>;
  if (isAuthenticated) return <p>You are logged in!</p>;
  return <p>Please log in to continue.</p>;
}
```

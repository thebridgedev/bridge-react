# bridge-react demo

Vite + React Router demo that implements the flows described in [`docs/DEMO_APP_PLAN.md`](../docs/DEMO_APP_PLAN.md).

## Getting started

```bash
bun install
cp demo/.env.example demo/.env
# fill in VITE_BRIDGE_APP_ID and the other values
bun run --filter demo dev
```

The app runs at <http://localhost:5173>. Sign in with your bridge credentials and follow the navigation to explore
authentication, feature flags, team management, subscription redirects, and token diagnostics.

## Key files

- `src/App.tsx` – route definitions with `ProtectedRoute`
- `src/components/Navbar.tsx` – navigation that reacts to auth state
- `src/components/FeatureFlagDemo.tsx` – cached vs live flag examples
- `src/pages/*` – the eight pages outlined in the demo plan
- `src/utils/env.ts` – reads Vite env variables and enforces the required fields
- `src/assets/styles.css` – shared styling used across the demo

## Environment variables

`demo/.env.example` lists every variable consumed by the demo. At a minimum set `VITE_BRIDGE_APP_ID` and
`VITE_BRIDGE_CALLBACK_URL`. Optional values such as `VITE_BRIDGE_TEAM_MANAGEMENT_URL` let you point at custom portals.

## Scripts

```bash
bun run --filter demo dev      # start the dev server
bun run --filter demo build    # type-check and build for production
bun run --filter demo preview  # preview the built output
```

## Next steps

- Toggle feature flags in bridge Control Center to see how the UI responds.
- Use the token status page to validate refresh behaviour before deploying middleware.
- Copy sections of this demo into your application – everything is designed to be drop-in.

// Route-gate cache invalidation (TBP-654). Internal — not re-exported.
//
// A plan- or entitlement-targeted gate's verdict depends on the user's plan,
// entitlements and token, not on the flag definition. bridge-react has no
// declarative route rules; routes are gated by `useFlag` / `<FeatureFlag>`
// guard components (see learning/feature-flags/using/guard-routes.md), which
// re-evaluate only when the flag registry's change bus fires. The billing
// attribute provider reads the live billing stores at eval time, but nothing
// told React a plan change had happened, so a Free→Pro upgrade left a
// `<FlagRoute flag="pro-page">` guard redirecting until something else (the
// token refresh the upgrade triggers, if it ever landed) bumped the bus.
//
// Two caches are dropped here:
//   1. auth-core's FeatureFlagService (5-min TTL) — read by apps that call
//      `getBridgeAuth().isFeatureEnabled()` / an auth-core route guard directly.
//   2. every `useFlag` / `<FeatureFlag>` / `flagStore` snapshot, by notifying
//      the registry so each re-evaluates against the current plan and claims.
//
// Both are free (no fetch). There is no generation guard as in bridge-svelte:
// react's gate evaluation is synchronous against the live stores, so no
// in-flight verdict can land after an invalidation and be written back.
import { getBridgeAuth } from './bridge-instance';
import { notifyAllFlagsChanged } from '../flags/registry';

/** Drop every cached gate verdict so the next evaluation uses current state. */
export function invalidateRouteGuardCache(): void {
  try {
    getBridgeAuth().invalidateFeatureFlagCache();
  } catch {
    // BridgeAuth not initialised yet — there is no cache to drop.
  }
  notifyAllFlagsChanged();
}

// Route-gate cache invalidation and the pending authorization change (TBP-654).
// Internal, except `settleBridgeAuthorizationChange`, which the package exports.
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
//
// The pending-change promise exists for a second race (the upgrade race): the
// page learns about a plan change, and shows the new plan, a few hundred ms
// before the token that carries it arrives. A decision taken in that window
// with the token (an app's one-shot navigation check, a server call that reads
// the plan claim) is judged on the old plan. The runtime registers the token
// refresh an authorization-affecting event starts; anything that decides with
// the token can wait for it, bounded, via `settleBridgeAuthorizationChange()`.
import { getBridgeAuth } from './bridge-instance';
import { notifyAllFlagsChanged } from '../flags/registry';

/**
 * How long a decision waits for the token refresh a plan, entitlements or
 * user-state change started. Past it the caller decides with the token it has,
 * which for a protected page is the old (fail-closed) verdict.
 */
export const AUTHORIZATION_CHANGE_WAIT_MS = 3_000;

let _pendingChange: Promise<void> | null = null;

/** Drop every cached gate verdict so the next evaluation uses current state. */
export function invalidateRouteGuardCache(): void {
  try {
    getBridgeAuth().invalidateFeatureFlagCache();
  } catch {
    // BridgeAuth not initialised yet — there is no cache to drop.
  }
  notifyAllFlagsChanged();
}

/**
 * Register the token refresh started by an authorization-affecting event.
 * The tracked promise never rejects; it clears itself once settled.
 */
export function trackAuthorizationChange(refresh: Promise<unknown>): Promise<void> {
  const tracked: Promise<void> = refresh
    .then(
      () => undefined,
      () => undefined,
    )
    .finally(() => {
      if (_pendingChange === tracked) _pendingChange = null;
    });
  _pendingChange = tracked;
  return tracked;
}

/** The refresh in flight for an authorization change, or `null` when there is none. */
export function pendingAuthorizationChange(): Promise<void> | null {
  return _pendingChange;
}

/** Forget any pending change (runtime stop / test reset). */
export function clearPendingAuthorizationChange(): void {
  _pendingChange = null;
}

/**
 * Wait until no authorization-change refresh is in flight, or until `deadline`
 * (epoch ms). Never throws. Returns immediately — without yielding — when
 * nothing is pending, so a signed-out visitor's navigation is not delayed.
 */
export async function settleAuthorizationChange(deadline: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // A change that lands while we wait (a second event after the first
    // refresh finished) starts a new refresh; wait for that too, within the
    // same deadline.
    for (let pending = _pendingChange; pending; pending = _pendingChange) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) return;
      const expired = await Promise.race([
        pending.then(() => false),
        new Promise<true>((resolve) => {
          timer = setTimeout(() => resolve(true), remaining);
        }),
      ]);
      clearTimeout(timer);
      if (expired) return;
      if (_pendingChange === pending) return; // settled but not yet cleared
    }
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Wait for the token a plan, entitlements or user-state change is refreshing
 * (TBP-654), then decide. Resolves once the refresh lands, or after `timeoutMs`
 * (default 3 s) with the token the session still has — so a protected page
 * stays refused rather than hanging. Resolves at once when nothing is pending,
 * which is always the case for a signed-out visitor. Never rejects.
 *
 * `useFlag` / `<FeatureFlag>` gates need no call: they re-evaluate on their own
 * when the new token lands. Use this in a one-shot check of your own, e.g.
 * before a navigation that reads the plan from the token.
 */
export function settleBridgeAuthorizationChange(timeoutMs: number = AUTHORIZATION_CHANGE_WAIT_MS): Promise<void> {
  return settleAuthorizationChange(Date.now() + timeoutMs);
}

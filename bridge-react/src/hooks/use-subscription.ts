import { type SubscriptionState, useBridgeStore } from '../core/bridge-instance';

/**
 * Subscription state (status + plan list + loading/error) — mirrors bridge-svelte's `subscriptionStore`.
 *
 * Call `loadSubscription()` from `@nebulr-group/bridge-react` to fetch.
 */
export function useSubscription(): SubscriptionState {
  return useBridgeStore((s) => s.subscription);
}

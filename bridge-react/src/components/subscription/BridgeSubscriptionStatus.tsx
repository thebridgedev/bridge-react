/**
 * Billing 2.0 / Phase A / US-2 (TBP-248) — ported from bridge-svelte's
 * `BridgeSubscriptionStatus.svelte` (via bridge-nextjs).
 *
 * Drop-in component that renders the workspace's current canonical plan name
 * + subscription status. Reads auth-core's billing `useBridge().subscription`
 * surface (the new billing-specific reactive surface — parallel to FF 2.0's
 * BridgeFlags). Do NOT confuse with the older `<PlanSelector />` which consumes
 * the Stripe-direct path via the bridge store's `subscription` slice.
 *
 * Reactive translation (§5.1): svelte `$state(useBridge().subscription.snapshot())`
 * + `onMount(() => subscription.subscribe(...))` → `useBridgeSnapshot(subscribe,
 * getSnapshot)`. The read on mount (`ensureBillingState()`) stays in a `useEffect`.
 *
 * Live: auth-core patches the store on billing pushes, and the billing store's
 * refresh rule (TBP-762) re-reads it on sign-in renewal, live billing events
 * and tab focus.
 */
import { useEffect } from 'react';
import { useBridge } from '@nebulr-group/bridge-auth-core';
import { ensureBillingState } from '../../core/billing-state';
import { useBridgeSnapshot } from '../../hooks/use-bridge-readable';

export interface BridgeSubscriptionStatusProps {
  /** Optional class applied to the root span. */
  className?: string;
}

export function BridgeSubscriptionStatus({
  className = '',
}: BridgeSubscriptionStatusProps) {
  const subscription = useBridge().subscription;

  const snapshot = useBridgeSnapshot(
    (onChange) => subscription.subscribe(() => onChange()),
    () => subscription.snapshot(),
  );

  useEffect(() => {
    // TBP-762 — through the billing store: read unless a read younger than
    // 30 s exists, renew an out-of-date sign-in, retry once, and stay current
    // on the refresh rule (sign-in renewal, live billing events, tab focus).
    void ensureBillingState();
  }, []);

  return (
    <span className={`bridge-subscription-status ${className}`.trim()}>
      {snapshot.loading ? (
        <span className="bss-loading">Loading…</span>
      ) : snapshot.error ? (
        <span className="bss-error">Subscription unavailable</span>
      ) : snapshot.state ? (
        <>
          <span className="bss-plan">{snapshot.state.plan.name}</span>
          <span className={`bss-badge bss-badge-${snapshot.state.status}`}>
            {snapshot.state.status}
          </span>
        </>
      ) : (
        <span className="bss-empty">No subscription</span>
      )}
    </span>
  );
}

export default BridgeSubscriptionStatus;

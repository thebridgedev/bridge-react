/**
 * Billing 2.0 — ported from bridge-svelte's `BridgePaywall.svelte` (via bridge-nextjs).
 *
 * Fullscreen plan-selection paywall. Drop into the root layout to gate
 * unsubscribed users before they reach the app. While the subscription status
 * is known and the tenant has no plan selected (and the app hasn't opted out
 * via `paymentsAutoRedirect: false`), it renders a fullscreen modal with
 * `<PlanSelector />` inside; otherwise it renders its children.
 *
 * Data source mirrors svelte: the Stripe-direct subscription slice
 * (`useBridgeStore((s) => s.subscription)` + `loadSubscription()`), NOT the
 * auth-core billing surface — same source `<PlanSelector />` uses, so the gate
 * and the picker stay in lockstep.
 *
 * Reactive translation (§5.1): svelte `$derived($subscriptionStore.*)` → Zustand
 * selector + `useMemo`; `onMount(loadSubscription)` → `useEffect`;
 * `{#if}/{:else}` → JSX; `{@render children?.()}` → `{children}`.
 *
 * Prop names hold the svelte public contract (`successRedirect` /
 * `cancelRedirect`) and pass straight through to `<PlanSelector />`, which
 * builds the absolute Stripe return URL (routing through the OAuth-callback
 * confirm-checkout handler) internally.
 */
import { useEffect, useMemo, type ReactNode } from 'react';
import type { Plan, PriceOfferSdk } from '@nebulr-group/bridge-auth-core';
import { loadSubscription, useBridgeStore } from '../../core/bridge-instance';
import { PlanSelector } from './PlanSelector';

export interface BridgePaywallProps {
  /** Where to send the user after a successful Stripe payment. @default '/' */
  successRedirect?: string;
  /** Where to send the user if they cancel Stripe Checkout. @default '/' */
  cancelRedirect?: string;
  /** Called after free-plan or direct plan change (not the Stripe redirect path). Use for analytics side-effects. */
  onSelect?: (detail: { plan: Plan; price: PriceOfferSdk }) => void;
  /** Override the default "Choose a plan" heading. */
  heading?: ReactNode;
  children?: ReactNode;
}

export function BridgePaywall({
  successRedirect = '/',
  cancelRedirect = '/',
  onSelect,
  heading,
  children,
}: BridgePaywallProps) {
  const subscription = useBridgeStore((s) => s.subscription);
  const { status, loading } = subscription;

  useEffect(() => {
    if (!status && !loading) {
      void loadSubscription();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show paywall only once the subscription status is known and the tenant has
  // no plan selected. Respects paymentsAutoRedirect: false (opt-out flag).
  const showPaywall = useMemo(
    () =>
      !loading &&
      !!status?.shouldSelectPlan &&
      status?.paymentsAutoRedirect !== false,
    [loading, status],
  );

  if (!showPaywall) {
    return <>{children}</>;
  }

  return (
    <div
      className="bridge-paywall"
      role="dialog"
      aria-modal="true"
      aria-label="Choose a plan"
    >
      <div className="bridge-paywall-panel">
        {heading ?? <h2 className="bridge-paywall-heading">Choose a plan</h2>}
        <PlanSelector
          successRedirect={successRedirect}
          cancelRedirect={cancelRedirect}
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}

export default BridgePaywall;

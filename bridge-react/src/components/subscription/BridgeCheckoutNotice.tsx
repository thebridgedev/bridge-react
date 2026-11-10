/**
 * TBP-945 (port of bridge-svelte TBP-813) — the "you're on Pro now" banner
 * after a checkout.
 *
 * A completed checkout (or a Free pick) lands on `billing.successRoute`, the
 * subscription page by default, which shows this banner itself. To land
 * somewhere else and still say so, put it on that page or in the layout:
 *
 *   <BridgeCheckoutNotice />
 *
 * It renders nothing until a checkout has just completed, shows once, and is
 * gone after a reload. `children` replaces the text and receives the result;
 * for a message of your own anywhere else, read `useCheckoutResult()`.
 */
import { useEffect, useState, type ReactNode } from 'react';
import type { Plan } from '@nebulr-group/bridge-auth-core';
import { useBridgeStore } from '../../core/bridge-instance';
import {
  clearCheckoutResult,
  getCheckoutResult,
  subscribeCheckoutResult,
  type BridgeCheckoutResult,
} from '../../core/checkout-result';
import { useBillingSnapshot } from './use-billing-snapshot';

/** What `children` receives: the result, with the plan name when it is known. */
export type BridgeCheckoutNoticeContext = Omit<BridgeCheckoutResult, 'planName'> & { planName: string | null };

export interface BridgeCheckoutNoticeProps {
  /** Optional class on the banner. */
  className?: string;
  /** Show a close button. @default true */
  dismissible?: boolean;
  /** Replaces the banner's text. Receives the result, with the plan name when known. */
  children?: (result: BridgeCheckoutNoticeContext) => ReactNode;
}

export function BridgeCheckoutNotice({ className = '', dismissible = true, children }: BridgeCheckoutNoticeProps) {
  const [shown, setShown] = useState<BridgeCheckoutResult | null>(null);
  const billingPlanName = useBillingSnapshot()?.state?.plan.name ?? null;
  const storePlan = useBridgeStore((s) => s.subscription.status?.plan) as unknown;

  useEffect(() => {
    // Take the result as soon as it is set, so it shows once, including on a
    // page that is already open when a Free pick lands back on it.
    const take = () => {
      const value = getCheckoutResult();
      if (!value) return;
      setShown(value);
      queueMicrotask(clearCheckoutResult);
    };
    take();
    return subscribeCheckoutResult(take);
  }, []);

  if (!shown) return null;

  const planName =
    shown.planName ||
    billingPlanName ||
    (storePlan && typeof storePlan === 'object' ? ((storePlan as Plan).name ?? null) : null);

  return (
    <div
      className={`bridge-checkout-notice ${className}`.trim()}
      data-bridge-checkout-notice
      data-kind={shown.kind}
      role="status"
    >
      <svg className="bridge-checkout-notice-icon" width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.6" />
        <path d="M6 10.2l2.6 2.6L14 7.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div className="bridge-checkout-notice-body">
        {children ? (
          children({ ...shown, planName })
        ) : (
          <>
            <strong className="bridge-checkout-notice-title">
              {planName ? `You're on ${planName} now` : 'Your new plan is active'}
            </strong>
            <span className="bridge-checkout-notice-text">
              {shown.kind === 'checkout'
                ? 'Your payment went through and the new plan is active.'
                : 'The change takes effect right away.'}
            </span>
          </>
        )}
      </div>
      {dismissible ? (
        <button
          type="button"
          className="bridge-checkout-notice-close"
          aria-label="Dismiss"
          onClick={() => setShown(null)}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

export default BridgeCheckoutNotice;

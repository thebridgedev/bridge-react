/**
 * TBP-743 (port of bridge-svelte TBP-702) — the "Manage billing" button: opens
 * the workspace's Stripe billing portal (payment method, invoices, cancel).
 *
 * Fetches a one-time portal URL at click time (the session is short-lived, so
 * it is never cached) and follows it. Renders only for someone who can act on
 * it: the workspace owner (`canManageBilling()`), on an app with payments on,
 * whose workspace already has a plan.
 */
import { useState, type ButtonHTMLAttributes } from 'react';
import { getBridgeAuth, useBridgeStore } from '../../core/bridge-instance';
import { Alert } from './shared/Alert';

export interface BillingPortalButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  /** The button text. @default 'Manage billing' */
  label?: string;
}

export function BillingPortalButton({ label = 'Manage billing', className = '', ...rest }: BillingPortalButtonProps) {
  const status = useBridgeStore((s) => s.subscription.status);
  const signedIn = useBridgeStore((s) => !!s.tokens?.accessToken);
  const [opening, setOpening] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  let canManage = false;
  if (signedIn && status) {
    try {
      canManage = getBridgeAuth().canManageBilling();
    } catch {
      canManage = false;
    }
  }
  const visible = canManage && !!status?.paymentsEnabled && !status?.shouldSelectPlan;
  if (!visible) return null;

  async function openPortal() {
    setOpening(true);
    setFailure(null);
    try {
      window.location.href = await getBridgeAuth().getBillingPortalUrl();
    } catch (err) {
      setFailure(err instanceof Error ? err.message : 'Could not open the billing portal');
      setOpening(false);
    }
  }

  return (
    <>
      {failure ? <Alert variant="error">{failure}</Alert> : null}
      <button
        type="button"
        className={`bridge-btn-secondary bridge-billing-portal-btn ${className}`.trim()}
        data-bridge-billing-portal
        disabled={opening}
        onClick={openPortal}
        {...rest}
      >
        {label}
      </button>
    </>
  );
}

export default BillingPortalButton;

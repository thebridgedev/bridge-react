/**
 * TBP-743 (port of bridge-svelte TBP-703/756) — the upgrade dialog.
 * `<BridgeProvider>` mounts it; the app writes nothing.
 *
 * When the app's backend refuses a request because a plan limit is reached
 * (402, code QUOTA_EXCEEDED — bridge-nestjs's @RequireQuota), it opens, names
 * the metric and the numbers, and links to the refusal's `fix` path or
 * `billing.manageRoute` (default /subscription). A member who cannot manage
 * billing is told to contact the workspace owner instead, with no Upgrade link.
 *
 * With no refusal and a `feature` set, it opens in its feature variant ("This
 * feature isn't on your plan", naming the plans that include it). That happens
 * only after the person did something gated; a page that merely renders a
 * hidden feature never opens it.
 *
 * `billing.upgradeDialog: false` turns it off; a component there replaces it
 * and receives the same props. Decoration only: the backend already refused
 * the write. This explains why.
 */
import { useEffect, useRef } from 'react';
import type { BridgeUpgradeDialogProps } from '../../types/config';
import { quotaMemberBody } from '../../core/billing-role';
import { plansIncludingFeature } from '../../core/upgrade-dialog';

export type { BridgeUpgradeDialogProps };

export function BridgeUpgradeDialog({
  refusal,
  upgradeHref,
  canUpgrade,
  onClose,
  feature = null,
  plans = null,
}: BridgeUpgradeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const featureVariant = !refusal && feature != null;
  const isOpen = !!refusal || featureVariant;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    try {
      if (isOpen && !dialog.open) dialog.showModal();
      else if (!isOpen && dialog.open) dialog.close();
    } catch {
      // No modal support (an old browser, a test DOM): fall back to the attribute.
      if (isOpen) dialog.setAttribute('open', '');
      else dialog.removeAttribute('open');
    }
  }, [isOpen]);

  const hasNumbers = refusal?.used != null && refusal?.limit != null;
  const includedIn = plansIncludingFeature(plans, feature);

  const actions = canUpgrade ? (
    <div className="bridge-team-dialog-actions">
      <button type="button" className="bridge-btn bridge-btn-secondary" onClick={() => onClose()}>
        Not now
      </button>
      <a
        className="bridge-btn bridge-btn-primary"
        href={upgradeHref}
        data-bridge-upgrade-dialog-cta
        onClick={() => onClose()}
      >
        Upgrade plan
      </a>
    </div>
  ) : (
    <div className="bridge-team-dialog-actions">
      <button type="button" className="bridge-btn bridge-btn-primary" onClick={() => onClose()}>
        OK
      </button>
    </div>
  );

  const included =
    includedIn.length > 0 ? (
      <p className="bridge-team-dialog-message" data-bridge-upgrade-dialog-included-in>
        Included in: {includedIn.join(', ')}
      </p>
    ) : null;

  return (
    <dialog
      ref={dialogRef}
      className="bridge-team-dialog bridge-upgrade-dialog"
      data-bridge-upgrade-dialog
      data-metric={refusal?.metric}
      data-variant={featureVariant ? 'feature' : refusal ? 'limit' : undefined}
      data-feature={featureVariant ? (feature ?? undefined) : undefined}
      aria-labelledby="bridge-upgrade-dialog-title"
      onClose={() => {
        if (isOpen) onClose();
      }}
    >
      {featureVariant ? (
        <div className="bridge-team-dialog-content">
          <h3 id="bridge-upgrade-dialog-title" className="bridge-team-dialog-title">
            This feature isn't on your plan
          </h3>
          <p
            className="bridge-team-dialog-message"
            data-bridge-upgrade-dialog-message
            data-variant={canUpgrade ? 'admin' : 'member'}
          >
            {canUpgrade ? 'Upgrade the plan to use it.' : 'Ask the workspace owner to upgrade the plan to use it.'}
          </p>
          {included}
          {actions}
        </div>
      ) : refusal ? (
        <div className="bridge-team-dialog-content">
          <h3 id="bridge-upgrade-dialog-title" className="bridge-team-dialog-title">
            You've reached your plan's limit
          </h3>
          <p
            className="bridge-team-dialog-message"
            data-bridge-upgrade-dialog-message
            data-variant={canUpgrade ? 'admin' : 'member'}
          >
            {!canUpgrade ? (
              quotaMemberBody(refusal.metric, 'over')
            ) : hasNumbers ? (
              <>
                This workspace has used <strong>{refusal.used?.toLocaleString()}</strong> of{' '}
                <strong>{refusal.limit?.toLocaleString()}</strong>{' '}
                <strong data-bridge-upgrade-dialog-metric>{refusal.metric}</strong> on its current plan.
              </>
            ) : (
              <>
                This workspace has reached its <strong data-bridge-upgrade-dialog-metric>{refusal.metric}</strong>{' '}
                limit.
              </>
            )}
            {canUpgrade ? ' Upgrade the plan to keep going.' : null}
          </p>
          {included}
          {actions}
        </div>
      ) : null}
    </dialog>
  );
}

export default BridgeUpgradeDialog;

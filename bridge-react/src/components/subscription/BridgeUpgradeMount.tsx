/**
 * TBP-743 — what `<BridgeProvider>` renders for the upgrade dialog: it reads
 * the pending plan-limit refusal and feature upgrade, and mounts the built-in
 * `<BridgeUpgradeDialog>`, the app's own (`billing.upgradeDialog: MyDialog`),
 * or nothing (`billing.upgradeDialog: false`). A plan-limit refusal wins when
 * both are pending.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { getBridgeConfig, loadSubscription, useBridgeStore } from '../../core/bridge-instance';
import { dismissQuotaRefusal, getQuotaRefusal, subscribeQuotaRefusal } from '../../core/quota-refusal';
import { dismissFeatureUpgrade, getFeatureUpgrade, subscribeFeatureUpgrade } from '../../core/feature-upgrade';
import { resolveUpgradeDialog, upgradeHrefFor } from '../../core/upgrade-dialog';
import { isBillingAdmin } from '../../core/billing-role';
import { BridgeUpgradeDialog } from './BridgeUpgradeDialog';

function close(): void {
  dismissQuotaRefusal();
  dismissFeatureUpgrade();
}

export function BridgeUpgradeMount() {
  const refusal = useSyncExternalStore(subscribeQuotaRefusal, getQuotaRefusal, getQuotaRefusal);
  const upgrade = useSyncExternalStore(subscribeFeatureUpgrade, getFeatureUpgrade, getFeatureUpgrade);
  const subscription = useBridgeStore((s) => s.subscription);
  const signedIn = useBridgeStore((s) => !!s.tokens?.accessToken);

  // The feature variant names the plans that include the feature, from the
  // plan list. Load it once when that variant opens.
  useEffect(() => {
    if (!upgrade || !signedIn) return;
    const { plans, loading, error } = subscription;
    if (!plans && !loading && !error) void loadSubscription();
  }, [upgrade, signedIn, subscription]);

  const billing = getBridgeConfig()?.billing;
  const Dialog = resolveUpgradeDialog(billing);
  if (!Dialog) return null;
  const Component = Dialog === 'default' ? BridgeUpgradeDialog : Dialog;

  const open = !!refusal || !!upgrade;
  const feature = refusal ? null : upgrade ? (upgrade.feature ?? upgrade.flag ?? '') : null;

  return (
    <Component
      refusal={refusal}
      upgradeHref={upgradeHrefFor(refusal ?? upgrade, billing)}
      // Re-read for every refusal: the same owner rule as <BridgeQuotaBanner>.
      canUpgrade={open ? isBillingAdmin() : false}
      onClose={close}
      feature={feature}
      plans={subscription.plans}
    />
  );
}

export default BridgeUpgradeMount;

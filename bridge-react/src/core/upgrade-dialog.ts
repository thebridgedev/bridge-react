// TBP-743 (port of bridge-svelte TBP-703/755) — which upgrade dialog
// <BridgeProvider> mounts, and where its button goes. Plain functions a unit
// test can call with a config.

import type { ComponentType } from 'react';
import type { BridgeQuotaRefusal } from './quota-refusal';
import type { BridgeConfig, BridgeUpgradeDialogProps, PlanWithFeatures } from '../types/config';
import { resolveBillingRoutes } from './billing-routes';

/**
 * The dialog to mount for a `billing` config: the built-in one (`default`), the
 * app's own component, or none (`null`). Anything that is not `false` and not a
 * component is the built-in default: the dialog is on unless turned off.
 */
export function resolveUpgradeDialog(
  billing: BridgeConfig['billing'] | undefined,
): 'default' | ComponentType<BridgeUpgradeDialogProps> | null {
  const setting = billing?.upgradeDialog;
  if (setting === false) return null;
  if (typeof setting === 'function' || (typeof setting === 'object' && setting !== null)) {
    return setting as ComponentType<BridgeUpgradeDialogProps>;
  }
  return 'default';
}

/**
 * Where the upgrade button goes: the refusal's own `fix` path (already limited
 * to a same-app path), else `billing.manageRoute` (default `/subscription`).
 */
export function upgradeHrefFor(
  refusal: Pick<BridgeQuotaRefusal, 'fix'> | null,
  billing: BridgeConfig['billing'] | undefined,
): string {
  return refusal?.fix ?? resolveBillingRoutes(billing).manageRoute;
}

/**
 * The names of the plans that include `feature`, cheapest first (the plan
 * picker's order). Empty when there is no feature, no plan list, or no plan
 * lists it.
 */
export function plansIncludingFeature(
  plans: ReadonlyArray<PlanWithFeatures> | null | undefined,
  feature: string | null | undefined,
): string[] {
  if (!feature || !plans) return [];
  const cheapest = (p: PlanWithFeatures): number => {
    const amounts = (p.prices ?? []).map((price) => price.amount);
    return amounts.length > 0 ? Math.min(...amounts) : Number.POSITIVE_INFINITY;
  };
  return plans
    .filter((p) => (p.features ?? []).some((f) => f.key === feature))
    .sort((a, b) => cheapest(a) - cheapest(b))
    .map((p) => p.name);
}

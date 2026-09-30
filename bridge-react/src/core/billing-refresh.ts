// TBP-743 — re-read everything billing after something changed the plan (a
// plan pick, a checkout). Mirrors bridge-svelte's `refreshBilling()`: the plan
// list and current plan (the subscription slice `<PlanSelector>` reads) and
// the billing state (`<BridgeSubscriptionStatus>`, `<BridgeBillingNotice>`).
// Never throws: each read reports its own failure through its store.

import { useBridge as useBillingBridge } from '@nebulr-group/bridge-auth-core';
import { getBridgeAuth, loadSubscription } from './bridge-instance';
import { tokenStaleHandler } from './bridge-runtime';

export async function refreshBilling(): Promise<void> {
  await loadSubscription().catch(() => {});
  try {
    const ctx = getBridgeAuth().getApiContext();
    if (!ctx.accessToken) return;
    await useBillingBridge().subscription.mount({
      apiBaseUrl: ctx.apiBaseUrl,
      accessToken: ctx.accessToken,
      appId: ctx.appId,
      onTokenStale: tokenStaleHandler(),
    });
  } catch {
    /* the badge re-reads on its own next mount */
  }
}

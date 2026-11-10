// TBP-945 — the billing surface's snapshot (plan name, renewal date, card) for
// the subscription page's summary line and the checkout banner. Unlike
// <BridgeSubscriptionStatus>, it never mounts the surface or throws: before
// Bridge is set up it is simply `null`, and the caller shows less.

import { useEffect, useState } from 'react';
import { useBridge, type BillingSubscriptionSnapshot } from '@nebulr-group/bridge-auth-core';

export function useBillingSnapshot(): BillingSubscriptionSnapshot | null {
  const [snapshot, setSnapshot] = useState<BillingSubscriptionSnapshot | null>(null);
  useEffect(() => {
    try {
      const sub = useBridge().subscription;
      setSnapshot(sub.snapshot());
      return sub.subscribe((s) => setSnapshot(s));
    } catch {
      /* Bridge not initialised */
      return undefined;
    }
  }, []);
  return snapshot;
}

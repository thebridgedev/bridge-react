// TBP-762 — the billing screens' refresh rule. Ported from bridge-svelte's
// `core/billing-store.ts`.
//
// The plan list and current plan (the store slice `<PlanSelector>`,
// `<BridgePaywall>` and the subscription page read) and the canonical billing
// state (`<BridgeSubscriptionStatus>`, `<BridgeBillingNotice>`) are re-read
// together, on one rule:
//
//   - when the sign-in is renewed (a new access token: refresh, sign-in, the
//     re-mint a plan change causes);
//   - on a live billing event (plan change, subscription or payment lifecycle);
//   - when the tab regains focus and the last read is older than 30 seconds —
//     how a plan created, changed or removed in Bridge reaches an open page;
//   - one retry when a read fails.
//
// Screens call `ensureSubscription()` / `ensureBillingState()` on mount and
// read the stores. Only what some screen has asked for is re-read, so an app
// that never shows billing makes no extra calls.
//
// Before 0.9.1 nothing re-read the plan list after the first load: a plan added
// in Bridge did not appear until a reload.

import { useBridge as useBillingBridge } from '@nebulr-group/bridge-auth-core';
import {
  ensureSubscription,
  getBridgeAuth,
  loadSubscription,
  subscriptionWanted,
  useBridgeStore,
} from './bridge-instance';
import {
  BILLING_STALE_AFTER_MS,
  billingStateReadToken,
  billingStateWanted,
  ensureBillingState,
  refreshBillingState,
} from './billing-state';
import { readEntitlements } from './startup-reads';
import { logger } from '../utils/logger';

export { BILLING_STALE_AFTER_MS, ensureBillingState, refreshBillingState } from './billing-state';

function stateInStore(): boolean {
  try {
    return useBillingBridge().subscription.snapshot().state !== null;
  } catch {
    return false;
  }
}

/**
 * Re-read everything billing after something changed the plan (a plan pick, a
 * checkout, a live billing event): the plan list and current plan when a
 * screen has asked for them, the billing state, and the plan's features (what
 * `bridge:billing.entitlement.*` flag rules read; Bridge does not always push
 * `entitlements.changed` for a plan change). Never rejects.
 */
export async function refreshBilling(): Promise<void> {
  try {
    const reads: Promise<void>[] = [];
    if (subscriptionWanted()) reads.push(loadSubscription());
    if (billingStateWanted() || stateInStore()) reads.push(refreshBillingState());
    reads.push(readEntitlements());
    await Promise.all(reads);
  } catch (err) {
    // Bridge not initialised (tests): nothing to re-read.
    logger.debug('[bridge-billing] refresh skipped:', err);
  }
}

/** On mount: read what has not been read, or was read more than 30 s ago. */
export async function ensureBilling(maxAgeMs = BILLING_STALE_AFTER_MS): Promise<void> {
  try {
    await Promise.all([ensureSubscription(maxAgeMs), ensureBillingState(maxAgeMs)]);
  } catch (err) {
    logger.debug('[bridge-billing] ensure skipped:', err);
  }
}

/** Live events after which the billing stores are re-read. */
export const BILLING_REFRESH_EVENTS: ReadonlySet<string> = new Set([
  'subscription.plan_changed',
  'subscription.created',
  'subscription.updated',
  'subscription.canceled',
  'subscription.reactivated',
  'subscription.trial_started',
  'subscription.trial_converted',
  'subscription.trial_expired',
  'payment.succeeded',
  'payment.failed',
  'dunning.recovered',
  'dunning.exhausted',
]);

/** The runtime calls this for every realtime billing event. Never throws. */
export function billingEventReceived(kind: string): void {
  if (!BILLING_REFRESH_EVENTS.has(kind)) return;
  void refreshBilling();
}

/**
 * A renewed sign-in: re-read what the screens asked for. The runtime has
 * already re-read the billing state and the plan's features for a token that
 * changes the session or the plan (TBP-941); a read that started with this
 * token is not repeated.
 */
function signInRenewed(token: string): void {
  const reads: Promise<void>[] = [];
  if (subscriptionWanted()) reads.push(loadSubscription());
  if ((billingStateWanted() || stateInStore()) && billingStateReadToken() !== token) {
    reads.push(refreshBillingState());
  }
  void Promise.all(reads);
}

let _stop: (() => void) | null = null;

/**
 * Install the sign-in-renewal and tab-focus triggers. Browser only; returns
 * the stop function. Idempotent: a second call replaces the first.
 * `<BridgeProvider>` calls it on mount.
 */
export function startBillingRefresh(): () => void {
  _stop?.();
  let lastToken = useBridgeStore.getState().tokens?.accessToken ?? null;
  const offToken = useBridgeStore.subscribe((state) => {
    const token = state.tokens?.accessToken ?? null;
    if (token === lastToken) return;
    lastToken = token;
    if (token) signInRenewed(token);
  });

  const onFocus = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    try {
      if (!getBridgeAuth().getApiContext().accessToken) return;
    } catch {
      return;
    }
    const reads: Promise<void>[] = [];
    if (subscriptionWanted()) reads.push(ensureSubscription(BILLING_STALE_AFTER_MS));
    if (billingStateWanted() || stateInStore()) reads.push(ensureBillingState(BILLING_STALE_AFTER_MS));
    void Promise.all(reads);
  };
  const win = typeof window !== 'undefined' && typeof window.addEventListener === 'function' ? window : null;
  const doc = typeof document !== 'undefined' && typeof document.addEventListener === 'function' ? document : null;
  win?.addEventListener('focus', onFocus);
  doc?.addEventListener('visibilitychange', onFocus);

  const stop = () => {
    offToken();
    win?.removeEventListener('focus', onFocus);
    doc?.removeEventListener('visibilitychange', onFocus);
    if (_stop === stop) _stop = null;
  };
  _stop = stop;
  return stop;
}

/** Test-only. */
export function __resetBillingRefreshForTests(): void {
  _stop?.();
  _stop = null;
}

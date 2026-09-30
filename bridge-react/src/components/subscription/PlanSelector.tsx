/**
 * The plan picker. React port of bridge-svelte's `PlanSelector.svelte`
 * (TBP-743 brings it to parity): billing-interval tabs, cheapest plan first,
 * each plan's features, a confirm step before an instant plan switch, a retry
 * when the plan list is empty, and the Stripe checkout / free pick flow of
 * `plan-pick.ts`.
 *
 * Customising a card (TBP-515 S2), cheapest first:
 *   - `planDescription({ plan, isCurrent })` replaces the description paragraph;
 *   - `planFooter({ plan, isCurrent })` renders at the bottom of the card;
 *   - `planCard({ plan, prices, isCurrent, interval, onPick })` replaces the
 *     whole card.
 */
import type { Plan, PriceOfferSdk } from '@nebulr-group/bridge-auth-core';
import type { HTMLAttributes, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ensureSubscription,
  getBridgeAuth,
  getBridgeConfig,
  loadSubscription,
  useBridgeStore,
} from '../../core/bridge-instance';
import { refreshBilling } from '../../core/billing-refresh';
import { getRouterAdapter } from '../../utils/router-adapter';
import { pickPlan } from './plan-pick';
import { Alert } from './shared/Alert';
import { Spinner } from './shared/Spinner';

type BillingInterval = PriceOfferSdk['recurrenceInterval'];

type UiState = 'idle' | 'payment-failed' | 'setup-payments' | 'select-plan' | 'active' | 'trial';

export interface PlanCardContext {
  plan: Plan;
  /** The plan's full price list. */
  prices: PriceOfferSdk[];
  isCurrent: boolean;
  /** The active interval tab. */
  interval: BillingInterval;
  onPick: (price: PriceOfferSdk) => void;
}

export interface PlanSelectorProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** Where to send the user after a successful pick or checkout. @default '/subscription' */
  successRedirect?: string;
  /** Where to send the user after a cancelled Stripe checkout. @default '/subscription' */
  cancelRedirect?: string;
  /**
   * Which billing interval tab is selected by default. Falls back to the first
   * available interval when no plan offers the requested one.
   * @default 'year'
   */
  defaultInterval?: BillingInterval;
  /**
   * Called after a free-plan or direct plan change (not the Stripe redirect
   * path). When given, the picker stays put instead of going to
   * `successRedirect` — the page took over.
   */
  onSelect?: (detail: { plan: Plan; price: PriceOfferSdk }) => void;
  /** Replaces the whole default card. */
  planCard?: (ctx: PlanCardContext) => ReactNode;
  /** Replaces the default card's description paragraph. */
  planDescription?: (ctx: { plan: Plan; isCurrent: boolean }) => ReactNode;
  /** Rendered at the bottom of the default card, after the price buttons. */
  planFooter?: (ctx: { plan: Plan; isCurrent: boolean }) => ReactNode;
  emptyState?: ReactNode;
  loadingState?: ReactNode;
}

const INTERVAL_LABELS: Record<BillingInterval, string> = {
  day: 'Daily',
  week: 'Weekly',
  month: 'Monthly',
  year: 'Yearly',
};

const INTERVAL_ORDER: BillingInterval[] = ['day', 'week', 'month', 'year'];

function minAmount(plan: Plan): number {
  const amounts = (plan.prices ?? []).map((p) => p.amount);
  return amounts.length > 0 ? Math.min(...amounts) : Number.POSITIVE_INFINITY;
}

// The features the plan includes — the same list the upgrade dialog reads.
// Structural: an older auth-core `Plan` type has no `features`.
function planFeatures(plan: Plan): ReadonlyArray<{ key: string; name: string }> {
  return (plan as Plan & { features?: ReadonlyArray<{ key: string; name: string }> }).features ?? [];
}

function formatPrice(price: PriceOfferSdk): string {
  return price.amount === 0
    ? 'Free'
    : `${price.amount} ${price.currency.toUpperCase()} / ${price.recurrenceInterval}`;
}

export function PlanSelector({
  successRedirect = '/subscription',
  cancelRedirect = '/subscription',
  defaultInterval = 'year',
  onSelect,
  planCard,
  planDescription,
  planFooter,
  emptyState,
  loadingState,
  className,
  style,
  ...rest
}: PlanSelectorProps) {
  const subscription = useBridgeStore((s) => s.subscription);
  const { status, plans, loading, error: storeError } = subscription;

  const [picking, setPicking] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [intervalOverride, setIntervalOverride] = useState<BillingInterval | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{ plan: Plan; price: PriceOfferSdk } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    // Read unless the store holds a read younger than 30 s.
    void ensureSubscription();
    return () => clearTimeout(successTimer.current);
  }, []);

  const uiState: UiState = useMemo(() => {
    if (!status) return 'idle';
    if (status.paymentFailed) return 'payment-failed';
    if (status.shouldSetupPayments) return 'setup-payments';
    if (status.shouldSelectPlan) return 'select-plan';
    if (status.trial) return 'trial';
    if (status.paymentsEnabled || status.plan) return 'active';
    return 'select-plan';
  }, [status]);

  // `status.plan` is a Plan object from the REST endpoint; a string from JWT-derived paths.
  const planField = status?.plan as unknown as { key: string } | string | undefined;
  const currentPlanKey = typeof planField === 'string' ? planField : (planField?.key ?? null);

  // Distinct billing intervals offered by any *paid* price, in display order.
  const availableIntervals = useMemo(
    () =>
      INTERVAL_ORDER.filter((i) =>
        (plans ?? []).some((plan) => plan.prices.some((p) => p.amount > 0 && p.recurrenceInterval === i)),
      ),
    [plans],
  );
  const showIntervalTabs = availableIntervals.length >= 2;
  const selectedInterval: BillingInterval =
    intervalOverride && availableIntervals.includes(intervalOverride)
      ? intervalOverride
      : availableIntervals.includes(defaultInterval)
        ? defaultInterval
        : (availableIntervals[0] ?? defaultInterval);

  // Prices to show under the active tab — at most one per interval: the active
  // interval's price, else a free price from any interval so a free plan stays
  // selectable under every tab.
  function pricesForInterval(plan: Plan): PriceOfferSdk[] {
    const exact = plan.prices.filter((p) => p.recurrenceInterval === selectedInterval);
    if (exact.length > 0) return exact;
    const free = plan.prices.find((p) => p.amount === 0);
    return free ? [free] : [];
  }

  // Cheapest first, by each plan's cheapest price across ALL intervals, so the
  // order stays put when the user toggles Monthly/Yearly.
  const sortedPlans = useMemo(() => [...(plans ?? [])].sort((a, b) => minAmount(a) - minAmount(b)), [plans]);

  const currentPlanName =
    (plans ?? []).find((p) => p.key === currentPlanKey)?.name ?? currentPlanKey ?? 'your current plan';

  function showSuccess(message: string): void {
    setSuccessNotice(message);
    clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setSuccessNotice(null), 6000);
  }

  async function retryPlans(): Promise<void> {
    setRetrying(true);
    try {
      await loadSubscription();
    } finally {
      setRetrying(false);
    }
  }

  async function confirmPlanChange(): Promise<void> {
    if (!confirmTarget) return;
    const { plan, price } = confirmTarget;
    setConfirmBusy(true);
    setConfirmError(null);
    try {
      await getBridgeAuth().changePlan(plan.key, price);
      await refreshBilling();
      setConfirmTarget(null);
      showSuccess(`You're now on ${plan.name} (${formatPrice(price)}).`);
      onSelect?.({ plan, price });
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : 'Plan change failed');
    } finally {
      setConfirmBusy(false);
    }
  }

  async function handlePick(plan: Plan, price: PriceOfferSdk): Promise<void> {
    setPicking(true);
    setPickError(null);
    try {
      const callbackBase =
        getBridgeConfig()?.callbackUrl ?? `${window.location.origin}/auth/oauth-callback`;
      const outcome = await pickPlan(
        plan,
        price,
        { paymentsEnabled: !!status?.paymentsEnabled, successRedirect, cancelRedirect, callbackBase, onSelect },
        {
          auth: getBridgeAuth() as unknown as Parameters<typeof pickPlan>[3]['auth'],
          refresh: refreshBilling,
          navigate: (url) => getRouterAdapter().navigate(url),
          leave: (url) => {
            window.location.href = url;
          },
        },
      );
      if (outcome === 'confirm') {
        // Already has a payment method — an instant switch, so ask first.
        setConfirmTarget({ plan, price });
        setConfirmError(null);
      }
    } catch (err) {
      setPickError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setPicking(false);
    }
  }

  async function goToPortal(): Promise<void> {
    try {
      await getBridgeAuth().redirectToPlanSelection();
    } catch (err) {
      setPickError(err instanceof Error ? err.message : 'Failed to open billing portal');
    }
  }

  function defaultCard(plan: Plan, isCurrent: boolean, onPick: (price: PriceOfferSdk) => void): ReactNode {
    const visiblePrices = pricesForInterval(plan);
    const features = planFeatures(plan);
    return (
      <div
        key={plan.key}
        data-bridge-plan-card
        data-current={isCurrent}
        data-trial={plan.trial}
        className="bridge-plan-card"
      >
        <div className="bridge-plan-card-header">
          <h3 className="bridge-plan-name">{plan.name}</h3>
          {plan.trial && (plan.trialDays ?? 0) > 0 ? (
            <span className="bridge-plan-trial-badge">{plan.trialDays}-day trial</span>
          ) : null}
        </div>

        {planDescription ? (
          planDescription({ plan, isCurrent })
        ) : plan.description ? (
          <p className="bridge-plan-description">{plan.description}</p>
        ) : null}

        {features.length > 0 ? (
          <ul className="bridge-plan-features" data-bridge-plan-features aria-label={`Included in ${plan.name}`}>
            {features.map((feature) => (
              <li key={feature.key} className="bridge-plan-feature" data-feature={feature.key}>
                {feature.name}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="bridge-plan-prices">
          {visiblePrices.map((price) => (
            <button
              key={price.recurrenceInterval + price.currency}
              type="button"
              className="bridge-btn-primary bridge-plan-select-btn"
              disabled={isCurrent || picking}
              onClick={() => onPick(price)}
            >
              {isCurrent
                ? 'Current plan'
                : price.amount === 0
                  ? 'Select free plan'
                  : `${price.amount} ${price.currency.toUpperCase()} / ${price.recurrenceInterval}`}
            </button>
          ))}

          {plan.prices.length === 0 ? (
            <button
              type="button"
              className="bridge-btn-primary bridge-plan-select-btn"
              disabled={isCurrent || picking}
              onClick={() =>
                handlePick(plan, { id: '', amount: 0, currency: 'usd', recurrenceInterval: 'month' } as PriceOfferSdk)
              }
            >
              {isCurrent ? 'Current plan' : 'Select plan'}
            </button>
          ) : visiblePrices.length === 0 ? (
            <p className="bridge-plan-unavailable" data-bridge-plan-unavailable>
              Not available {INTERVAL_LABELS[selectedInterval].toLowerCase()}
            </p>
          ) : null}
        </div>

        {planFooter ? planFooter({ plan, isCurrent }) : null}
      </div>
    );
  }

  return (
    <div
      className={className}
      style={style}
      data-bridge-plan-selector
      data-loading={loading || picking}
      data-state={uiState}
      {...rest}
    >
      {loading ? (
        (loadingState ?? (
          <div className="bridge-plan-loading">
            <Spinner />
          </div>
        ))
      ) : storeError ? (
        <Alert variant="error">{storeError}</Alert>
      ) : (
        <>
          {pickError ? <Alert variant="error">{pickError}</Alert> : null}

          {successNotice ? (
            <div className="bridge-plan-success" data-bridge-plan-success role="status">
              <Alert variant="success">{successNotice}</Alert>
            </div>
          ) : null}

          {uiState === 'payment-failed' ? (
            <div data-bridge-plan-payment-failed className="bridge-plan-payment-failed">
              <Alert variant="error">Your last payment failed. Please update your payment method to continue.</Alert>
              <button type="button" className="bridge-btn-primary bridge-plan-portal-btn" onClick={goToPortal}>
                Manage billing
              </button>
            </div>
          ) : null}

          {plans && plans.length === 0 ? (
            (emptyState ?? (
              <div className="bridge-plan-empty" data-bridge-plan-empty>
                <p>The plans could not be loaded.</p>
                <button type="button" className="bridge-btn-primary" onClick={retryPlans} disabled={retrying}>
                  {retrying ? 'Loading…' : 'Try again'}
                </button>
              </div>
            ))
          ) : plans ? (
            <>
              {showIntervalTabs ? (
                <div
                  className="bridge-plan-interval-tabs"
                  data-bridge-plan-interval-tabs
                  role="group"
                  aria-label="Billing interval"
                >
                  {availableIntervals.map((interval) => (
                    <button
                      key={interval}
                      type="button"
                      className="bridge-plan-interval-tab"
                      data-active={interval === selectedInterval}
                      aria-pressed={interval === selectedInterval}
                      onClick={() => setIntervalOverride(interval)}
                    >
                      {INTERVAL_LABELS[interval]}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="bridge-plan-cards" data-bridge-plan-cards>
                {sortedPlans.map((plan) => {
                  const isCurrent = plan.key === currentPlanKey;
                  const onPick = (price: PriceOfferSdk) => void handlePick(plan, price);
                  if (planCard) {
                    return (
                      <div key={plan.key} style={{ display: 'contents' }}>
                        {planCard({ plan, prices: plan.prices, isCurrent, interval: selectedInterval, onPick })}
                      </div>
                    );
                  }
                  return defaultCard(plan, isCurrent, onPick);
                })}
              </div>
            </>
          ) : null}
        </>
      )}

      {confirmTarget ? (
        <div
          className="bridge-plan-confirm-backdrop"
          data-bridge-plan-confirm
          role="dialog"
          aria-modal="true"
          aria-labelledby="bridge-plan-confirm-title"
          tabIndex={-1}
        >
          <div className="bridge-plan-confirm">
            <h3 id="bridge-plan-confirm-title" className="bridge-plan-confirm-title">
              Change plan?
            </h3>
            <p className="bridge-plan-confirm-body">
              Switch from <strong>{currentPlanName}</strong> to <strong>{confirmTarget.plan.name}</strong> (
              {formatPrice(confirmTarget.price)}).
            </p>
            <p className="bridge-plan-confirm-note">
              The change takes effect immediately — any price difference is prorated on your next invoice.
            </p>
            {confirmError ? <Alert variant="error">{confirmError}</Alert> : null}
            <div className="bridge-plan-confirm-actions">
              <button
                type="button"
                className="bridge-btn-secondary"
                disabled={confirmBusy}
                onClick={() => setConfirmTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bridge-btn-primary"
                data-bridge-plan-confirm-btn
                disabled={confirmBusy}
                onClick={confirmPlanChange}
              >
                {confirmBusy ? 'Switching…' : 'Confirm change'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default PlanSelector;

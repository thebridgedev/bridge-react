/**
 * The plans on offer, as cards, with an interval switch (Monthly / Yearly)
 * when the plans have more than one. Choosing a plan changes it, or sends the
 * person to checkout when it needs a payment method; switching from a paid
 * plan asks to confirm first.
 *
 * Only a person with the `billingManage` flag may choose. Anyone else sees
 * the plans with the buttons off and a note to ask the workspace owner.
 *
 * `planCard` replaces a whole card; `planDescription` and `planFooter`
 * replace parts of the default one.
 */
import type { Plan, PlanChange, Price } from '@nebulr-group/bridge-auth-core';
import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { getBridge } from '../../core/client.js';
import { errorMessage } from '../../core/i18n.js';
import { useBilling, useCanManageBilling, useFlagsStatus, usePlans, useTranslator } from '../../react/hooks.js';
import { Alert } from '../shared/Alert.js';
import { Spinner } from '../shared/Spinner.js';
import { BillingPortalButton } from './BillingPortalButton.js';
import { formatAmount, formatPrice, intervalSuffix, isFreePick, minAmount, pickKind, pickLabel, planFeatures, trialDays } from './plan-format.js';

export interface PlanCardContext {
	readonly plan: Plan;
	/** The plan's full price list. */
	readonly prices: readonly Price[];
	readonly isCurrent: boolean;
	/** The selected interval. */
	readonly interval: string;
	readonly canChoose: boolean;
	readonly onPick: (price?: Price) => void;
}

export interface PlanPickerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
	/** A heading above the plans, beside the interval switch. */
	readonly heading?: string;
	/** The interval selected at first, when the plans offer it. @default 'year' */
	readonly defaultInterval?: string;
	/** Called after the plan changed here (not when the person is sent to checkout). */
	readonly onChanged?: (detail: { plan: Plan; change: PlanChange }) => void;
	/** Replaces a whole card. */
	readonly planCard?: (context: PlanCardContext) => ReactNode;
	/** Replaces the default card's description. */
	readonly planDescription?: (context: { plan: Plan; isCurrent: boolean }) => ReactNode;
	/** Rendered at the bottom of the default card. */
	readonly planFooter?: (context: { plan: Plan; isCurrent: boolean }) => ReactNode;
	readonly emptyState?: ReactNode;
	readonly loadingState?: ReactNode;
}

const INTERVAL_ORDER = ['day', 'week', 'month', 'year'];
const INTERVAL_LABELS: Record<string, string> = { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' };

function intervalLabel(interval: string): string {
	return INTERVAL_LABELS[interval] ?? interval.charAt(0).toUpperCase() + interval.slice(1);
}

function changeNotice(plan: Plan, price: Price | undefined, status: PlanChange['status']): string {
	switch (status) {
		case 'scheduled':
			return `You'll move to ${plan.name} at the end of this billing period.`;
		case 'waiting_for_payment':
			return `You'll move to ${plan.name} once the payment goes through.`;
		default:
			return `You're now on ${plan.name} (${formatPrice(price)}).`;
	}
}

export function PlanPicker({
	heading,
	defaultInterval = 'year',
	onChanged,
	planCard,
	planDescription,
	planFooter,
	emptyState,
	loadingState,
	...rest
}: PlanPickerProps) {
	const t = useTranslator();
	const canManage = useCanManageBilling();
	const billing = useBilling();
	const plans = usePlans();
	const flagsStatus = useFlagsStatus();

	const [picking, setPicking] = useState(false);
	const [pickError, setPickError] = useState<string | null>(null);
	const [successNotice, setSuccessNotice] = useState<string | null>(null);
	const successTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const [confirmTarget, setConfirmTarget] = useState<{ plan: Plan; price: Price | undefined } | null>(null);
	const [confirmBusy, setConfirmBusy] = useState(false);
	const [confirmError, setConfirmError] = useState<string | null>(null);
	const [retrying, setRetrying] = useState(false);
	const [intervalOverride, setIntervalOverride] = useState<string | null>(null);

	useEffect(() => () => clearTimeout(successTimer.current), []);

	const facts = billing.value;
	const currentKey = facts?.plan?.key ?? null;
	const loading = plans.value === null && plans.error === null;
	const loadError = plans.value === null && plans.error !== null ? errorMessage(plans.error, t, 'error.generic') : null;
	const list = (plans.value ?? []).filter((p) => !p.archived || p.key === currentKey);
	const flagsKnown = flagsStatus === 'ready' || flagsStatus === 'error';

	const uiState = !facts
		? 'idle'
		: facts.access === 'payment_due' || facts.status === 'past_due'
			? 'payment-failed'
			: facts.plan === null || facts.access === 'needs_plan'
				? 'select-plan'
				: facts.status === 'trialing'
					? 'trial'
					: 'active';

	// Intervals any paid price is offered in, in a stable order.
	const found = list.flatMap((plan) => plan.prices.filter((p) => p.amount > 0 && p.interval).map((p) => p.interval as string));
	const others = found.filter((i, at) => !INTERVAL_ORDER.includes(i) && found.indexOf(i) === at);
	const availableIntervals = [...INTERVAL_ORDER.filter((i) => found.includes(i)), ...others];
	const showIntervalTabs = availableIntervals.length >= 2;
	const selectedInterval =
		intervalOverride && availableIntervals.includes(intervalOverride)
			? intervalOverride
			: availableIntervals.includes(defaultInterval)
				? defaultInterval
				: (availableIntervals[0] ?? defaultInterval);

	// Cheapest first, by each plan's cheapest price in any interval, so cards stay put on a tab switch.
	const sortedPlans = [...list].sort((a, b) => minAmount(a) - minAmount(b));
	const currentPlan = list.find((p) => p.key === currentKey) ?? null;
	const currentPlanName = currentPlan?.name ?? facts?.plan?.name ?? 'your current plan';

	// The prices a card shows under the selected interval: one button each. A
	// free or interval-less price shows under every tab.
	function pricesForInterval(plan: Plan): Price[] {
		const exact = plan.prices.filter((p) => p.interval === selectedInterval);
		if (exact.length > 0) return exact;
		const unbound = plan.prices.filter((p) => !p.interval);
		if (unbound.length > 0) return unbound;
		const free = plan.prices.find((p) => p.amount === 0);
		return free ? [free] : [];
	}

	function showSuccess(message: string): void {
		setSuccessNotice(message);
		clearTimeout(successTimer.current);
		successTimer.current = setTimeout(() => setSuccessNotice(null), 6000);
	}

	/** Chooses the plan. True when the person is on their way to checkout. */
	async function choose(plan: Plan, price: Price | undefined): Promise<boolean> {
		const change = await getBridge().billing.choosePlan({
			plan: plan.key,
			...(price ? { currency: price.currency } : {}),
			...(price?.interval ? { interval: price.interval } : {}),
		});
		if (change.status === 'payment_required') {
			window.location.assign(change.checkout.url);
			return true;
		}
		await billing.refresh();
		showSuccess(changeNotice(plan, price, change.status));
		onChanged?.({ plan, change });
		return false;
	}

	// Switching away from a paid plan happens without checkout, so it is confirmed first.
	function needsConfirm(plan: Plan, price: Price | undefined): boolean {
		return !isFreePick(plan, price) && currentPlan !== null && currentPlan.key !== plan.key && minAmount(currentPlan) > 0;
	}

	async function handlePick(plan: Plan, price?: Price): Promise<void> {
		if (!canManage || picking) return;
		setPickError(null);
		if (needsConfirm(plan, price)) {
			setConfirmTarget({ plan, price });
			setConfirmError(null);
			return;
		}
		setPicking(true);
		let leaving = false;
		try {
			leaving = await choose(plan, price);
		} catch (error) {
			setPickError(errorMessage(error, t, 'error.generic'));
		} finally {
			if (!leaving) setPicking(false);
		}
	}

	async function confirmPlanChange(): Promise<void> {
		if (!confirmTarget) return;
		const { plan, price } = confirmTarget;
		setConfirmBusy(true);
		setConfirmError(null);
		let leaving = false;
		try {
			leaving = await choose(plan, price);
			setConfirmTarget(null);
		} catch (error) {
			setConfirmError(errorMessage(error, t, 'error.generic'));
		} finally {
			if (!leaving) setConfirmBusy(false);
		}
	}

	async function retryPlans(): Promise<void> {
		setRetrying(true);
		try {
			await plans.refresh();
		} finally {
			setRetrying(false);
		}
	}

	const intervalTabs = (
		<div className="bridge-plan-interval-tabs" data-bridge-plan-interval-tabs="" role="group" aria-label="Billing interval">
			{availableIntervals.map((interval) => (
				<button
					key={interval}
					type="button"
					className="bridge-plan-interval-tab"
					data-active={interval === selectedInterval}
					aria-pressed={interval === selectedInterval}
					onClick={() => setIntervalOverride(interval)}
				>
					{intervalLabel(interval)}
				</button>
			))}
		</div>
	);

	function card(plan: Plan) {
		const isCurrent = plan.key === currentKey;
		const onPick = (price?: Price) => void handlePick(plan, price);
		const visiblePrices = pricesForInterval(plan);
		const kind = pickKind(plan, currentPlan);
		const days = trialDays(plan);
		const features = planFeatures(plan);
		const buttonClass = `${kind === 'current' || kind === 'switch' ? 'bridge-btn-secondary' : 'bridge-btn-primary'} bridge-plan-select-btn`;

		if (planCard) {
			return <PlanCardSlot key={plan.key}>{planCard({ plan, prices: plan.prices, isCurrent, interval: selectedInterval, canChoose: canManage, onPick })}</PlanCardSlot>;
		}
		return (
			<div
				key={plan.key}
				data-bridge-plan-card=""
				data-plan={plan.key}
				data-current={isCurrent}
				data-trial={days !== null}
				data-pick={kind}
				className="bridge-plan-card"
			>
				{isCurrent && (
					<span className="bridge-plan-current-flag" data-bridge-plan-current-flag="">
						Your plan
					</span>
				)}
				<div className="bridge-plan-card-header">
					<h3 className="bridge-plan-name">{plan.name}</h3>
					{days !== null && <span className="bridge-plan-trial-badge">{days}-day trial</span>}
				</div>

				{visiblePrices[0] ? (
					<div className="bridge-plan-price" data-bridge-plan-price="">
						<span className="bridge-plan-price-amount">{formatAmount(visiblePrices[0].amount, visiblePrices[0].currency)}</span>
						<span className="bridge-plan-price-interval">{intervalSuffix(visiblePrices[0])}</span>
					</div>
				) : plan.free ? (
					<div className="bridge-plan-price" data-bridge-plan-price="">
						<span className="bridge-plan-price-amount">Free</span>
					</div>
				) : null}

				{planDescription ? planDescription({ plan, isCurrent }) : plan.description ? <p className="bridge-plan-description">{plan.description}</p> : null}

				{features.length > 0 && (
					<ul className="bridge-plan-features" data-bridge-plan-features="" aria-label={`Included in ${plan.name}`}>
						{features.map((feature) => (
							<li key={feature.key} className="bridge-plan-feature" data-feature={feature.key}>
								<svg className="bridge-plan-feature-check" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
									<path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
								</svg>
								<span>{feature.name}</span>
							</li>
						))}
					</ul>
				)}

				<div className="bridge-plan-prices">
					{visiblePrices.map((price) => (
						<button key={`${price.interval ?? ''}:${price.currency}`} className={buttonClass} disabled={isCurrent || picking || !canManage} onClick={() => onPick(price)}>
							{pickLabel(kind, plan)}
							{visiblePrices.length > 1 && !isCurrent ? ` · ${formatAmount(price.amount, price.currency)}` : null}
						</button>
					))}

					{plan.prices.length === 0 ? (
						<button className={buttonClass} disabled={isCurrent || picking || !canManage} onClick={() => onPick()}>
							{pickLabel(kind, plan)}
						</button>
					) : visiblePrices.length === 0 ? (
						<p className="bridge-plan-unavailable" data-bridge-plan-unavailable="">
							Not available {intervalLabel(selectedInterval).toLowerCase()}
						</p>
					) : null}
				</div>

				{planFooter?.({ plan, isCurrent })}
			</div>
		);
	}

	return (
		<div data-bridge-plan-selector="" data-loading={loading || picking} data-state={uiState} data-can-manage={canManage} {...rest}>
			{loading ? (
				(loadingState ?? (
					<div className="bridge-plan-loading">
						<Spinner />
					</div>
				))
			) : loadError ? (
				<>
					<Alert variant="error">{loadError}</Alert>
					<div className="bridge-plan-empty" data-bridge-plan-empty="">
						<button type="button" className="bridge-btn-primary" onClick={() => void retryPlans()} disabled={retrying}>
							{retrying ? 'Loading…' : 'Try again'}
						</button>
					</div>
				</>
			) : (
				<>
					{pickError && <Alert variant="error">{pickError}</Alert>}

					{successNotice && (
						<div className="bridge-plan-success" data-bridge-plan-success="" role="status">
							<Alert variant="success">{successNotice}</Alert>
						</div>
					)}

					{uiState === 'payment-failed' && (
						<div data-bridge-plan-payment-failed="" className="bridge-plan-payment-failed">
							<Alert variant="error">
								{canManage
									? 'Your last payment failed. Please update your payment method to continue.'
									: 'Your last payment failed. Ask the workspace owner to update the payment method.'}
							</Alert>
							<BillingPortalButton className="bridge-plan-portal-btn" />
						</div>
					)}

					{list.length === 0 ? (
						(emptyState ?? (
							<div className="bridge-plan-empty" data-bridge-plan-empty="">
								<p>No plans are available yet.</p>
							</div>
						))
					) : (
						<>
							{heading ? (
								<div className="bridge-plan-head" data-bridge-plan-head="">
									<h2 className="bridge-plan-heading">{heading}</h2>
									{showIntervalTabs && intervalTabs}
								</div>
							) : (
								showIntervalTabs && intervalTabs
							)}

							{flagsKnown && !canManage && (
								<p className="bridge-plan-manage-note" data-bridge-plan-manage-note="">
									Ask the workspace owner to change the plan.
								</p>
							)}

							<div className="bridge-plan-cards" data-bridge-plan-cards="">
								{sortedPlans.map(card)}
							</div>
						</>
					)}
				</>
			)}

			{confirmTarget && (
				<div className="bridge-plan-confirm-backdrop" data-bridge-plan-confirm="" role="dialog" aria-modal="true" aria-labelledby="bridge-plan-confirm-title" tabIndex={-1}>
					<div className="bridge-plan-confirm">
						<h3 id="bridge-plan-confirm-title" className="bridge-plan-confirm-title">
							Change plan?
						</h3>
						<p className="bridge-plan-confirm-body">
							Switch from <strong>{currentPlanName}</strong> to <strong>{confirmTarget.plan.name}</strong> ({formatPrice(confirmTarget.price)}).
						</p>
						<p className="bridge-plan-confirm-note">Any price difference shows on your next invoice.</p>
						{confirmError && <Alert variant="error">{confirmError}</Alert>}
						<div className="bridge-plan-confirm-actions">
							<button type="button" className="bridge-btn-secondary" disabled={confirmBusy} onClick={() => setConfirmTarget(null)}>
								Cancel
							</button>
							<button type="button" className="bridge-btn-primary" data-bridge-plan-confirm-btn="" disabled={confirmBusy} onClick={() => void confirmPlanChange()}>
								{confirmBusy ? 'Switching…' : 'Confirm change'}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

/** Keys a custom card in the list without adding an element. */
function PlanCardSlot({ children }: { children: ReactNode }) {
	return <>{children}</>;
}

export default PlanPicker;

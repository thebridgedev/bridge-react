/**
 * The one billing notice worth showing now, most urgent first: access locked,
 * a payment due, no plan, a trial ending, the subscription ending, or a plan
 * change waiting. Renders nothing when all is well. A person with the
 * `billingManage` flag gets a link to the billing pages; anyone else is told
 * to ask the workspace owner. Not dismissible: it goes when the facts change.
 *
 * A workspace locked for payment shows to every person, from the lock Bridge
 * keeps (`useBillingGate`), and at once when your API refuses a write with the
 * lock's 402 through `bridgeFetch`. With `mode="hard"` the lock covers the page
 * as a blocking screen; every other notice stays a banner.
 */
import { billingNotice, type BillingFacts, type BillingNotice as Notice, type Plan } from '@nebulr-group/bridge-auth-core';
import type { HTMLAttributes, MouseEvent } from 'react';
import { useBillingGate } from '../../react/billing-gate.js';
import { useBilling, useBridgeConfig, useCanManageBilling, usePlans } from '../../react/hooks.js';
import { Link } from '../shared/Link.js';
import { formatDate } from './plan-format.js';

type Chassis = 'bar' | 'rail' | 'card';
type Severity = 'info' | 'warn' | 'critical' | 'locked';

export interface BillingNoticeProps extends HTMLAttributes<HTMLDivElement> {
	/** The notice's shape: a full-width bar, a rail with a left edge, or a card. @default 'rail' */
	readonly chassis?: Chassis;
	/** `hard` covers the page with a blocking screen while the workspace is locked for payment; other notices stay banners. @default 'soft' */
	readonly mode?: 'soft' | 'hard';
	/** Where the action link goes. @default the plan page for no plan, else the subscription page */
	readonly actionHref?: string;
	/** Replaces the action link's navigation. */
	readonly onActionClick?: (notice: Notice) => void;
}

const SEVERITY: Record<Notice['kind'], Severity> = {
	blocked: 'locked',
	'payment-due': 'critical',
	'needs-plan': 'critical',
	'trial-ending': 'warn',
	ending: 'warn',
	waiting: 'info',
};

const OWNER = 'Please contact your workspace owner.';
const BLOCKED: Notice = { kind: 'blocked' };

function daysLeft(days: number): string {
	if (days <= 0) return 'The trial ends today.';
	return `${days} ${days === 1 ? 'day' : 'days'} left.`;
}

function copyFor(n: Notice, admin: boolean, facts: BillingFacts | null, plans: readonly Plan[] | null): { title: string; body: string; cta?: string } {
	const current = facts?.plan?.name ?? 'your plan';
	const planName = (key: string) => plans?.find((p) => p.key === key)?.name ?? key;
	switch (n.kind) {
		case 'blocked':
			return admin ? { title: 'Access locked', body: 'Update the payment method to restore access.', cta: 'Update card' } : { title: 'Access locked', body: OWNER };
		case 'payment-due':
			return admin
				? { title: 'Payment failed', body: `We couldn't charge your card. Update your payment method to keep using ${current}.`, cta: 'Update card' }
				: { title: "Your workspace's payment failed", body: 'Please contact your workspace owner to update the payment method.' };
		case 'needs-plan':
			return admin ? { title: 'No active plan', body: 'Choose a plan to continue.', cta: 'Choose plan' } : { title: 'No active plan', body: OWNER };
		case 'trial-ending':
			return admin
				? { title: 'Trial ending soon', body: `${daysLeft(n.daysLeft)} Add a payment method to keep your access.`, cta: 'Add card' }
				: { title: 'Trial ending soon', body: daysLeft(n.daysLeft) };
		case 'ending': {
			const ends = formatDate(n.periodEnd);
			return admin
				? {
						title: 'Subscription ending',
						body: ends ? `Your subscription ends ${ends}. You'll keep full access until then.` : "Your subscription is ending. You'll keep access until the period ends.",
						cta: 'Manage billing',
					}
				: { title: 'Subscription ending', body: ends ? `Your workspace's subscription ends ${ends}.` : "Your workspace's subscription is ending." };
		}
		case 'waiting':
			return n.waitsFor === 'payment'
				? { title: 'Waiting for payment', body: `The move to ${planName(n.plan)} starts once the payment goes through.` }
				: { title: 'Plan change scheduled', body: `The workspace moves to ${planName(n.plan)} at the end of this billing period.` };
	}
}

export function BillingNotice({ chassis = 'rail', mode = 'soft', actionHref, onActionClick, className, ...rest }: BillingNoticeProps) {
	const config = useBridgeConfig();
	const base = config?.billingBase ?? '/subscription';
	const canManage = useCanManageBilling();
	const billing = useBilling();
	const plans = usePlans();
	const gate = useBillingGate();

	// The lock is shown from the gate as well as the billing facts: the gate is read by every person, and a refusal shows it at once.
	const notice: Notice | null = gate.locked ? BLOCKED : billing.value ? billingNotice(billing.value) : null;
	if (!notice) return null;
	const severity = SEVERITY[notice.kind];
	const urgent = severity === 'critical' || severity === 'locked';
	const href = actionHref ?? (notice.kind === 'needs-plan' ? `${base}/plan` : base || '/');
	const copy = copyFor(notice, canManage, billing.value, plans.value);

	function handleAction(event: MouseEvent<HTMLAnchorElement>) {
		if (!onActionClick || !notice) return;
		event.preventDefault();
		onActionClick(notice);
	}

	if (mode === 'hard' && notice.kind === 'blocked') {
		return (
			<div
				className={['bridge-billing-lockscreen', className].filter(Boolean).join(' ')}
				data-bridge-billing-lockscreen=""
				role="alertdialog"
				aria-modal="true"
				aria-live="assertive"
				aria-labelledby="bridge-lock-title"
				{...rest}
			>
				<div className="bbl-panel">
					<strong id="bridge-lock-title" className="bbl-title">
						{copy.title}
					</strong>
					<span className="bbl-body">{copy.body}</span>
					{copy.cta && canManage && (
						<Link className="bbl-cta" href={href} data-bridge-billing-notice-cta="" onClick={handleAction}>
							{copy.cta}
						</Link>
					)}
				</div>
			</div>
		);
	}

	return (
		<div
			className={['bridge-billing-notice', className].filter(Boolean).join(' ')}
			data-bridge-billing-notice=""
			data-kind={notice.kind}
			data-severity={severity}
			data-chassis={chassis}
			role={urgent ? 'alert' : 'status'}
			aria-live={urgent ? 'assertive' : 'polite'}
			{...rest}
		>
			<div className="bbn-content">
				<strong className="bbn-title">{copy.title}</strong>
				<span className="bbn-body">{copy.body}</span>
			</div>
			{copy.cta && canManage && (
				<Link className="bbn-cta" href={href} data-bridge-billing-notice-cta="" onClick={handleAction}>
					{copy.cta}
				</Link>
			)}
		</div>
	);
}

export default BillingNotice;

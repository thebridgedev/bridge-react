/**
 * The workspace's plan name and a status badge (trial, active, past due,
 * ending, canceled), from the billing facts. It follows plan changes on its
 * own: the facts are fetched again on every billing change.
 */
import type { HTMLAttributes } from 'react';
import { errorMessage } from '../../core/i18n.js';
import { useBilling, useTranslator } from '../../react/hooks.js';
import { statusBadge } from './plan-format.js';

export type SubscriptionStatusProps = HTMLAttributes<HTMLSpanElement>;

export function SubscriptionStatus({ className, ...rest }: SubscriptionStatusProps) {
	const billing = useBilling();
	const t = useTranslator();
	const facts = billing.value;
	const view = facts ? (facts.plan ? 'plan' : 'empty') : billing.error ? 'error' : 'loading';
	const badge = facts ? statusBadge(facts) : null;

	return (
		<span
			className={['bridge-subscription-status', className].filter(Boolean).join(' ')}
			data-bridge-subscription-status=""
			data-state={view}
			data-status={facts?.status}
			{...rest}
		>
			{view === 'loading' ? (
				<span className="bss-loading">Loading…</span>
			) : view === 'error' ? (
				<span className="bss-error" title={errorMessage(billing.error, t, 'error.generic')}>
					Subscription unavailable
				</span>
			) : facts?.plan ? (
				<>
					<span className="bss-plan">{facts.plan.name}</span>
					{badge && (
						<span className="bss-badge" data-status={badge.status}>
							{badge.label}
						</span>
					)}
				</>
			) : (
				<span className="bss-empty">No subscription</span>
			)}
		</span>
	);
}

export default SubscriptionStatus;

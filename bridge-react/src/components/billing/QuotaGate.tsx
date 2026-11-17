/**
 * `<QuotaGate metric="tickets">`: the action inside is disabled once the workspace
 * is at its plan's hard limit, and an upgrade prompt shows beside it.
 *
 * ```tsx
 * <QuotaGate metric="tickets">
 *   <button onClick={createTicket}>New ticket</button>
 * </QuotaGate>
 *
 * <QuotaGate metric="tickets" atLimit={(q) => <>{q.used} of {q.limit} used. <a href="/subscription">Upgrade</a></>}>
 *   …
 * </QuotaGate>
 * ```
 *
 * Disabling is a `<fieldset disabled>` around the children, so every button,
 * input, select and textarea inside is disabled natively and announced as such,
 * with no props to thread through your markup. Links are not form controls: put
 * a link's action behind a button.
 *
 * Never disables on "don't know yet": while the quota is loading, the plan sets
 * no limit on the metric, or the limit is metered (it bills the overage instead
 * of blocking), the children are enabled. Only a known hard limit with nothing
 * left disables them.
 *
 * Decoration only. Your server refuses the write; this saves the person a click
 * that would be refused.
 */
import type { ReactNode } from 'react';
import type { QuotaState } from '../../core/quota.js';
import { useBridgeConfig } from '../../react/hooks.js';
import { useQuota } from '../../react/quota.js';

export interface QuotaGateProps {
	/** The metric's key, such as `tickets`. */
	readonly metric: string;
	/** The action or actions to disable at the limit. */
	readonly children: ReactNode;
	/** What to show at the limit instead of the default line. Receives the live quota. */
	readonly atLimit?: (quota: QuotaState) => ReactNode;
	/** Class on the wrapper. */
	readonly className?: string;
}

/** Where the gate stands for a metric. */
export type QuotaGateState = 'loading' | 'unlimited' | 'metered' | 'available' | 'at-limit';

/** The gate's decision for a quota. Exported for tests and custom gates. */
export function quotaGateState(quota: QuotaState): QuotaGateState {
	if (quota.loading) return 'loading';
	if (quota.unlimited) return 'unlimited';
	if (quota.snapshot?.policy === 'metered') return 'metered';
	const atCap = (quota.remaining !== null && quota.remaining <= 0) || (quota.used !== null && quota.limit !== null && quota.used >= quota.limit);
	return atCap ? 'at-limit' : 'available';
}

export function QuotaGate({ metric, children, atLimit, className }: QuotaGateProps) {
	const quota = useQuota(metric);
	const base = useBridgeConfig()?.billingBase ?? '/subscription';
	const state = quotaGateState(quota);
	const blocked = state === 'at-limit';

	return (
		<div className={['bridge-quota-gate', className].filter(Boolean).join(' ')} data-bridge-quota-gate="" data-metric={metric} data-state={state}>
			<fieldset disabled={blocked} className="bridge-quota-gate-controls" style={{ display: 'contents' }}>
				{children}
			</fieldset>
			{blocked && (
				<div className="bridge-quota-gate-limit" data-bridge-quota-gate-limit="" role="status">
					{atLimit ? (
						atLimit(quota)
					) : (
						<>
							You've used all {quota.limit?.toLocaleString()} {metric} on your plan. <a href={base || '/'}>Upgrade</a>
						</>
					)}
				</div>
			)}
		</div>
	);
}

export default QuotaGate;

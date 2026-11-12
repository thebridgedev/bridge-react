/**
 * A banner for one metric nearing or at its plan limit:
 *
 * ```tsx
 * <QuotaBanner metric="projects" label="Projects" />
 * ```
 *
 * Renders nothing below 80% of the limit, or for a metric with no limit. It
 * shows numbers only and blocks nothing: whether something is allowed is a
 * flag. A person with the `billingManage` flag gets an Upgrade link; anyone
 * else is told to contact the workspace owner.
 */
import type { HTMLAttributes, MouseEvent } from 'react';
import { useBridgeConfig, useCanManageBilling, useUsage } from '../../react/hooks.js';
import { Link } from '../shared/Link.js';
import { quotaFor, type Quota } from './quota.js';

export interface QuotaBannerProps extends HTMLAttributes<HTMLDivElement> {
	/** The metric to watch, such as `projects`. */
	readonly metric: string;
	/** The metric's name in the copy. @default the metric key */
	readonly label?: string;
	/** Where Upgrade goes. @default the subscription page */
	readonly actionHref?: string;
	/** Replaces Upgrade's navigation. */
	readonly onActionClick?: (quota: Quota) => void;
}

const OWNER = 'Contact your workspace owner.';

function copyFor(q: Quota, admin: boolean, what: string): { title: string; body: string } {
	const used = q.used.toLocaleString();
	const limit = q.limit.toLocaleString();
	if (q.used > q.limit) {
		return admin
			? { title: `${what} over cap`, body: `You've used ${used} of ${limit}. Upgrade your plan to add headroom.` }
			: { title: `${what} over cap`, body: `Your workspace is over its ${what} cap. ${OWNER}` };
	}
	if (q.state === 'over') {
		return admin
			? { title: `${what} limit reached`, body: `You've used all ${limit} on your plan. Upgrade your plan to add more.` }
			: { title: `${what} limit reached`, body: `Your workspace has reached its ${what} limit. ${OWNER}` };
	}
	const left = Math.max(0, q.limit - q.used).toLocaleString();
	return admin
		? { title: `${what} approaching cap`, body: `You've used ${used} of ${limit} (${left} left).` }
		: { title: `${what} approaching cap`, body: `Your workspace is approaching its ${what} cap.` };
}

export function QuotaBanner({ metric, label, actionHref, onActionClick, className, ...rest }: QuotaBannerProps) {
	const base = useBridgeConfig()?.billingBase ?? '/subscription';
	const canManage = useCanManageBilling();
	const usage = useUsage();

	const quota = quotaFor(usage.value, metric);
	if (quota === null || quota.state === 'ok') return null;
	const name = label ?? metric;
	const percent = Math.min(100, Math.round(quota.ratio * 100));
	const href = actionHref ?? (base || '/');
	const copy = copyFor(quota, canManage, name);

	function handleAction(event: MouseEvent<HTMLAnchorElement>) {
		if (!onActionClick || !quota) return;
		event.preventDefault();
		onActionClick(quota);
	}

	return (
		<div
			className={['bridge-quota-banner', className].filter(Boolean).join(' ')}
			data-bridge-quota-banner=""
			data-metric={metric}
			data-state={quota.state}
			role={quota.state === 'over' ? 'alert' : 'status'}
			aria-live={quota.state === 'over' ? 'assertive' : 'polite'}
			aria-label={`${name} quota ${percent}% used`}
			{...rest}
		>
			<div className="bqb-content">
				<strong className="bqb-title">{copy.title}</strong>
				<span className="bqb-body">{copy.body}</span>
				{quota.limit > 0 && (
					<div className="bqb-meter" aria-hidden="true">
						<div className="bqb-meter-fill" style={{ width: `${percent}%` }} />
					</div>
				)}
			</div>
			{canManage && (
				<Link className="bqb-cta" href={href} data-bridge-quota-banner-cta="" onClick={handleAction}>
					Upgrade
				</Link>
			)}
		</div>
	);
}

export default QuotaBanner;

/**
 * A banner for one metric nearing or at its plan limit:
 *
 * ```tsx
 * <QuotaBanner metric="projects" label="Projects" />
 * ```
 *
 * Renders nothing while the metric has no limit or is below 80% of it. It moves
 * by itself: Bridge's quota notices read the numbers again. It shows numbers
 * only and blocks nothing: whether something is allowed is a flag. A person with
 * the `billingManage` flag gets an Upgrade link; anyone else is told to contact
 * the workspace owner. A metered limit shows the overage instead of a warning.
 */
import type { QuotaSnapshot } from '@nebulr-group/bridge-auth-core';
import type { HTMLAttributes, MouseEvent } from 'react';
import { useBridgeConfig, useCanManageBilling } from '../../react/hooks.js';
import { useQuota } from '../../react/quota.js';
import { Link } from '../shared/Link.js';
import { quotaBannerCopy, quotaBannerState } from './quota-copy.js';

export interface QuotaBannerProps extends HTMLAttributes<HTMLDivElement> {
	/** The metric to watch, such as `projects`. */
	readonly metric: string;
	/** The metric's name in the copy. @default the metric's label from Bridge, else its key */
	readonly label?: string;
	/** Where Upgrade goes. @default the subscription page */
	readonly actionHref?: string;
	/** Replaces Upgrade's navigation. */
	readonly onActionClick?: (snapshot: QuotaSnapshot) => void;
}

export function QuotaBanner({ metric, label, actionHref, onActionClick, className, ...rest }: QuotaBannerProps) {
	const base = useBridgeConfig()?.billingBase ?? '/subscription';
	const canManage = useCanManageBilling();
	const { snapshot } = useQuota(metric);

	const state = quotaBannerState(snapshot);
	if (state === 'hidden' || snapshot === null) return null;
	const critical = state === 'critical' || state === 'reached' || state === 'over';
	const name = label ?? snapshot.label ?? metric;
	const percent = snapshot.limit > 0 ? Math.min(100, Math.round((snapshot.used / snapshot.limit) * 100)) : 0;
	const href = actionHref ?? (base || '/');
	const copy = quotaBannerCopy(snapshot, canManage, name);

	function handleAction(event: MouseEvent<HTMLAnchorElement>) {
		if (!onActionClick || snapshot === null) return;
		event.preventDefault();
		onActionClick(snapshot);
	}

	return (
		<div
			className={['bridge-quota-banner', className].filter(Boolean).join(' ')}
			data-bridge-quota-banner=""
			data-metric={metric}
			data-state={state}
			data-severity={critical ? 'critical' : 'warn'}
			role={critical ? 'alert' : 'status'}
			aria-live={critical ? 'assertive' : 'polite'}
			aria-label={`${name} quota ${percent}% used`}
			{...rest}
		>
			<div className="bqb-content">
				<strong className="bqb-title">{copy.title}</strong>
				<span className="bqb-body">{copy.body}</span>
				{snapshot.limit > 0 && (
					<div className="bqb-meter" aria-hidden="true">
						<div className="bqb-meter-fill" style={{ width: `${percent}%` }} />
					</div>
				)}
			</div>
			{copy.cta && canManage && (
				<Link className="bqb-cta" href={href} data-bridge-quota-banner-cta="" onClick={handleAction}>
					{copy.cta}
				</Link>
			)}
		</div>
	);
}

export default QuotaBanner;

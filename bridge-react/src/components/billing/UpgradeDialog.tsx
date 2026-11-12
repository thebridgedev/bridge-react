/**
 * The dialog a plan limit or a missing plan feature opens. `<BridgeProvider>`
 * renders it whenever a request is open (a 402 through `bridgeFetch`, or an
 * upgrade prompt). A person who may manage billing (the `billingManage` flag)
 * gets a link to the plan page; anyone else is told to ask the owner.
 */
import { sanitizeReturnTo } from '@nebulr-group/bridge-auth-core';
import { useEffect, useRef, type DialogHTMLAttributes } from 'react';
import type { UpgradeDialogProps as BaseProps } from '../../core/upgrade.js';
import { Link } from '../shared/Link.js';

export interface UpgradeDialogProps extends BaseProps, Omit<DialogHTMLAttributes<HTMLDialogElement>, 'onClose' | 'open'> {}

export function UpgradeDialog({ request, upgradeHref, canUpgrade, onClose, className, ...rest }: UpgradeDialogProps) {
	const dialog = useRef<HTMLDialogElement>(null);
	useEffect(() => {
		const element = dialog.current;
		if (element && !element.open && typeof element.showModal === 'function') element.showModal();
	}, []);

	const hasNumbers = typeof request.used === 'number' && typeof request.limit === 'number';
	// A link from the request is used only when it is a path on this site.
	const href = sanitizeReturnTo(request.upgradeHref) ?? upgradeHref;
	const variant = canUpgrade ? 'admin' : 'member';

	return (
		<dialog
			ref={dialog}
			className={['bridge-team-dialog', 'bridge-upgrade-dialog', className].filter(Boolean).join(' ')}
			data-bridge-upgrade-dialog=""
			data-variant={request.kind}
			data-metric={request.metric ?? undefined}
			data-feature={request.entitlement ?? request.flag ?? undefined}
			aria-labelledby="bridge-upgrade-dialog-title"
			onClose={() => onClose()}
			{...rest}
		>
			<div className="bridge-team-dialog-content">
				{request.kind === 'feature' ? (
					<>
						<h3 id="bridge-upgrade-dialog-title" className="bridge-team-dialog-title">
							This feature isn't on your plan
						</h3>
						<p className="bridge-team-dialog-message" data-bridge-upgrade-dialog-message="" data-variant={variant}>
							{canUpgrade ? 'Upgrade the plan to use it.' : 'Ask the workspace owner to upgrade the plan to use it.'}
						</p>
					</>
				) : (
					<>
						<h3 id="bridge-upgrade-dialog-title" className="bridge-team-dialog-title">
							You've reached your plan's limit
						</h3>
						<p className="bridge-team-dialog-message" data-bridge-upgrade-dialog-message="" data-variant={variant}>
							{hasNumbers && request.metric ? (
								<>
									This workspace has used <strong>{request.used?.toLocaleString()}</strong> of <strong>{request.limit?.toLocaleString()}</strong>{' '}
									<strong data-bridge-upgrade-dialog-metric="">{request.metric}</strong> on its current plan.
								</>
							) : request.metric ? (
								<>
									This workspace has reached its <strong data-bridge-upgrade-dialog-metric="">{request.metric}</strong> limit.
								</>
							) : (
								<>This workspace has reached a limit of its plan.</>
							)}{' '}
							{canUpgrade ? 'Upgrade the plan to keep going.' : 'Ask the workspace owner to upgrade the plan.'}
						</p>
					</>
				)}
				<div className="bridge-team-dialog-actions">
					{canUpgrade ? (
						<>
							<button type="button" className="bridge-btn bridge-btn-secondary" onClick={() => onClose()}>
								Not now
							</button>
							<Link className="bridge-btn bridge-btn-primary" href={href} data-bridge-upgrade-dialog-cta="" onClick={() => onClose()}>
								Upgrade plan
							</Link>
						</>
					) : (
						<button type="button" className="bridge-btn bridge-btn-primary" onClick={() => onClose()}>
							OK
						</button>
					)}
				</div>
			</div>
		</dialog>
	);
}

export default UpgradeDialog;

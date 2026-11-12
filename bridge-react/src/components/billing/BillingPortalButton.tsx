/**
 * "Manage billing": opens the workspace's billing portal (payment method,
 * invoices, cancelling). The portal address is fetched on click, since it is
 * short-lived. Renders only for a person with the `billingManage` flag.
 */
import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { getBridge } from '../../core/client.js';
import { errorMessage } from '../../core/i18n.js';
import { useCanManageBilling, useTranslator } from '../../react/hooks.js';
import { Alert } from '../shared/Alert.js';

export interface BillingPortalButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children'> {
	/** The button text. @default 'Manage billing' */
	readonly label?: string;
	/** Replaces the button text. */
	readonly children?: ReactNode;
}

export function BillingPortalButton({ label = 'Manage billing', children, className, ...rest }: BillingPortalButtonProps) {
	const canManage = useCanManageBilling();
	const t = useTranslator();
	const [opening, setOpening] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);

	async function openPortal() {
		if (opening) return;
		setOpening(true);
		setFailure(null);
		try {
			const { url } = await getBridge().billing.portal();
			window.location.assign(url);
		} catch (error) {
			setFailure(errorMessage(error, t, 'error.generic'));
			setOpening(false);
		}
	}

	if (!canManage) return null;
	return (
		<>
			{failure && <Alert variant="error">{failure}</Alert>}
			<button
				type="button"
				className={['bridge-btn-secondary', 'bridge-billing-portal-btn', className].filter(Boolean).join(' ')}
				data-bridge-billing-portal=""
				data-loading={opening}
				disabled={opening}
				onClick={() => void openPortal()}
				{...rest}
			>
				{children ?? label}
			</button>
		</>
	);
}

export default BillingPortalButton;

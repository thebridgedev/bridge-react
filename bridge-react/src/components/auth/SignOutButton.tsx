/**
 * Signs out here, in every tab, and at Bridge, then goes to `redirectTo`
 * (default `auth.afterSignOut`). Pass children for your own label.
 */
import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { getBridge, peekConfig } from '../../core/client.js';
import type { BridgeMessages } from '../../core/config.js';
import { useBridgeRouter, useTranslator } from '../../react/hooks.js';

export interface SignOutButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'children'> {
	readonly redirectTo?: string;
	readonly onSignOut?: () => void;
	readonly children?: ReactNode;
	readonly messages?: BridgeMessages;
}

export function SignOutButton({ redirectTo, onSignOut, children, messages, ...rest }: SignOutButtonProps) {
	const t = useTranslator(messages);
	const router = useBridgeRouter();
	const [busy, setBusy] = useState(false);

	async function signOut() {
		if (busy) return;
		setBusy(true);
		try {
			await getBridge().signOut();
		} finally {
			setBusy(false);
		}
		if (onSignOut) onSignOut();
		else router.navigate(redirectTo ?? peekConfig()?.afterSignOut ?? '/');
	}

	return (
		<button type="button" data-bridge-sign-out="" data-loading={busy} disabled={busy} onClick={() => void signOut()} {...rest}>
			{children ?? t('action.signOut')}
		</button>
	);
}

export default SignOutButton;

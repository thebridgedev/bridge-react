/**
 * Hosted mode (`hosted` in the config), `<auth base>/callback`: where Bridge's
 * hosted page sends the person back. It checks the return (its `state` and
 * issuer) and trades the code with the verifier this browser kept, then goes
 * on to where the person was going.
 */
import { takeReturnTo } from '@nebulr-group/bridge-auth-core';
import { useState, type ReactNode } from 'react';
import { getBridge, peekConfig } from '../../core/client.js';
import type { BridgeMessages } from '../../core/config.js';
import { errorMessage } from '../../core/i18n.js';
import { useBridgeRouter, useTranslator } from '../../react/hooks.js';
import { useMountOnce } from '../../react/once.js';
import { Alert } from '../shared/Alert.js';
import { AuthFormWrapper } from '../shared/AuthFormWrapper.js';
import { Link } from '../shared/Link.js';
import { Spinner } from '../shared/Spinner.js';

export interface HostedCallbackProps {
	/** Replaces the heading shown when finishing fails. */
	readonly heading?: ReactNode;
	readonly messages?: BridgeMessages;
}

export function HostedCallback({ heading, messages }: HostedCallbackProps) {
	const t = useTranslator(messages);
	const router = useBridgeRouter();
	const config = peekConfig();
	const authBase = config?.authBase ?? '/auth';
	const [failure, setFailure] = useState<string | null>(null);

	useMountOnce(async () => {
		const back = location.href;
		// The code and state leave the address bar and the history at once.
		history.replaceState(history.state, '', location.pathname);
		try {
			await getBridge().hosted.finish(back);
			router.navigate(takeReturnTo() ?? config?.afterSignIn ?? '/', { replace: true });
		} catch (error) {
			setFailure(errorMessage(error, t, 'link.error.invalid'));
		}
	});

	if (failure === null) {
		return (
			<AuthFormWrapper heading={null} data-bridge-hosted="finishing">
				<div className="bridge-auth-settling" data-bridge-auth-settling="">
					<Spinner size={24} />
				</div>
			</AuthFormWrapper>
		);
	}
	return (
		<AuthFormWrapper heading={heading === undefined ? t('login.heading') : heading} data-bridge-hosted="failed">
			<Alert variant="error">{failure}</Alert>
			<div className="bridge-form-footer">
				<Link href={`${authBase}/sign-in`} className="bridge-link">
					{t('action.backToSignIn')}
				</Link>
			</div>
		</AuthFormWrapper>
	);
}

export default HostedCallback;

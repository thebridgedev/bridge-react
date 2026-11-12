/**
 * Hosted mode (`hosted` in the config), the sign-in page: starts a sign-in
 * request at Bridge and sends the browser to the page Bridge hosts for the
 * app. `HostedCallback` finishes it when the person comes back.
 */
import { readReturnTo, stashReturnTo } from '@nebulr-group/bridge-auth-core';
import { useState, type ReactNode } from 'react';
import { getBridge, peekConfig } from '../../core/client.js';
import type { BridgeMessages } from '../../core/config.js';
import { errorMessage } from '../../core/i18n.js';
import { useBridgeRouter, useTranslator } from '../../react/hooks.js';
import { useMountOnce } from '../../react/once.js';
import { Alert } from '../shared/Alert.js';
import { AuthFormWrapper } from '../shared/AuthFormWrapper.js';
import { Spinner } from '../shared/Spinner.js';

export interface HostedSignInProps {
	/** Replaces the heading shown when starting fails. */
	readonly heading?: ReactNode;
	readonly messages?: BridgeMessages;
}

export function HostedSignIn({ heading, messages }: HostedSignInProps) {
	const t = useTranslator(messages);
	const router = useBridgeRouter();
	const [failure, setFailure] = useState<string | null>(null);

	useMountOnce(async () => {
		const config = peekConfig();
		try {
			const hosted = config?.hosted ?? {};
			const redirectUri = hosted.redirectUri ?? new URL(`${config?.authBase ?? '/auth'}/callback`, location.origin).toString();
			// Where to go once signed in survives the trip to Bridge's page, in this tab.
			stashReturnTo(readReturnTo(router.location.search, config?.returnToParam));
			location.assign(await getBridge().hosted.start({ redirectUri, ...(hosted.linkAddress === undefined ? {} : { linkAddress: hosted.linkAddress }) }));
		} catch (error) {
			setFailure(errorMessage(error, t, 'login.error.invalidCredentials'));
		}
	});

	if (failure === null) {
		return (
			<AuthFormWrapper heading={null} data-bridge-hosted="starting">
				<div className="bridge-auth-settling" data-bridge-auth-settling="">
					<Spinner size={24} />
				</div>
			</AuthFormWrapper>
		);
	}
	return (
		<AuthFormWrapper heading={heading === undefined ? t('login.heading') : heading} data-bridge-hosted="failed">
			<Alert variant="error">{failure}</Alert>
		</AuthFormWrapper>
	);
}

export default HostedSignIn;

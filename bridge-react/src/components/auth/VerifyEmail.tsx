/**
 * Finishes a sign-up from its email link, on the device that started it, and
 * signs the person in. Opened on another device it says so, and the link
 * still works on the right one.
 *
 * With `storage: 'memory'` the session lives only in the tab that started the
 * sign-up, so this page first hands the link to that tab; when one takes it,
 * this page says to go on there. When none does, this page finishes itself.
 *
 * Every wait has a bound: finishing fails with an error after a while, and
 * once signed in the page goes on, or offers a link when it cannot.
 */
import { isBridgeError, type SignInStep, type WorkspaceChoice } from '@nebulr-group/bridge-auth-core';
import { useState, type HTMLAttributes, type ReactNode } from 'react';
import { getBridge, peekConfig } from '../../core/client.js';
import type { BridgeMessages } from '../../core/config.js';
import { takeEmailLink } from '../../core/email-link.js';
import { bounded, handOff, leave } from '../../core/finish-link.js';
import { errorMessage } from '../../core/i18n.js';
import { offerSignUpLink, takeRelayedLink } from '../../core/link-relay.js';
import { useBridgeRouter, useTranslator } from '../../react/hooks.js';
import { useMountOnce } from '../../react/once.js';
import { Alert } from '../shared/Alert.js';
import { AuthFormWrapper } from '../shared/AuthFormWrapper.js';
import { Link } from '../shared/Link.js';
import { Spinner } from '../shared/Spinner.js';
import { WorkspaceChooser } from './WorkspaceChooser.js';

export interface VerifyEmailProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onError'> {
	/** The link's token. @default read from the page's address */
	readonly token?: string;
	/** Replaces the page's heading. */
	readonly heading?: ReactNode;
	/** Called once signed in. Without it, the page goes to `auth.afterSignIn`. */
	readonly onSignIn?: () => void;
	readonly onError?: (error: unknown) => void;
	readonly messages?: BridgeMessages;
}

type View =
	| { step: 'working' }
	| { step: 'continued' }
	| { step: 'signed-in'; to: string }
	| { step: 'workspace'; workspaces: readonly WorkspaceChoice[]; choose: (id: string) => Promise<SignInStep> }
	| { step: 'failed'; message: string; kind: string | null };

export function VerifyEmail({ token, heading, onSignIn, onError, messages, ...rest }: VerifyEmailProps) {
	const t = useTranslator(messages);
	const router = useBridgeRouter();
	const config = peekConfig();
	const authBase = config?.authBase ?? '/auth';
	const [view, setView] = useState<View>({ step: 'working' });

	async function finish() {
		if (onSignIn) {
			onSignIn();
			return;
		}
		// Signing in runs the route guard again, which can replace this navigation: go again, then offer a link.
		const to = config?.afterSignIn ?? '/';
		const here = location.pathname;
		if (!(await leave(async () => router.navigate(to), () => location.pathname !== here))) setView({ step: 'signed-in', to });
	}

	function fail(error: unknown) {
		setView({ step: 'failed', message: errorMessage(error, t, 'link.error.invalid'), kind: isBridgeError(error) ? error.kind : null });
		onError?.(error);
	}

	async function follow(step: SignInStep) {
		if (handOff(step)) setView({ step: 'working' });
		else if (step.done) await finish();
		else setView({ step: 'workspace', workspaces: step.workspaces, choose: step.choose });
	}

	async function start(found: string, relayed: boolean) {
		try {
			// The session belongs in the tab that started the sign-up (memory only): offer it the link first.
			if (!relayed && config?.storage === 'memory' && (await offerSignUpLink(config.issuer, found))) {
				setView({ step: 'continued' });
				return;
			}
			await follow(await bounded(getBridge().signUp.finish(found)));
		} catch (error) {
			fail(error);
		}
	}

	useMountOnce(() => {
		// A link another tab handed here (memory only), the token given, or the page's own address.
		const relayed = token === undefined ? takeRelayedLink() : null;
		const found = token ?? relayed ?? takeEmailLink('verify-email');
		if (found === null) {
			setView({ step: 'failed', message: t('verify.missingLink'), kind: null });
			return;
		}
		void start(found, relayed !== null);
	});

	async function choose(id: string) {
		if (view.step !== 'workspace') return;
		try {
			await follow(await view.choose(id));
		} catch (error) {
			fail(error);
		}
	}

	const pageHeading = heading === undefined ? t('signup.heading') : heading;

	switch (view.step) {
		case 'working':
			return (
				<AuthFormWrapper heading={null} data-bridge-verify-email="working" {...rest}>
					<div className="bridge-auth-settling" data-bridge-auth-settling="">
						<Spinner size={24} />
						<span>{t('verify.finishing')}</span>
					</div>
				</AuthFormWrapper>
			);
		case 'continued':
			return (
				<AuthFormWrapper heading={pageHeading} data-bridge-verify-email="continued" {...rest}>
					<Alert variant="info">{t('verify.continuedElsewhere')}</Alert>
				</AuthFormWrapper>
			);
		case 'signed-in':
			return (
				<AuthFormWrapper heading={pageHeading} data-bridge-verify-email="signed-in" {...rest}>
					<div className="bridge-form-footer">
						<Link href={view.to} className="bridge-link">
							{t('invite.continue')}
						</Link>
					</div>
				</AuthFormWrapper>
			);
		case 'workspace':
			return (
				<AuthFormWrapper heading={heading === undefined ? t('workspace.chooseHeading') : heading} data-bridge-verify-email="workspace" {...rest}>
					<WorkspaceChooser workspaces={view.workspaces} onChoose={choose} messages={messages} />
				</AuthFormWrapper>
			);
		case 'failed':
			return (
				<AuthFormWrapper heading={pageHeading} data-bridge-verify-email="failed" data-error-kind={view.kind ?? undefined} {...rest}>
					<Alert variant="error">{view.message}</Alert>
					<div className="bridge-form-footer">
						<Link href={`${authBase}/sign-in`} className="bridge-link">
							{t('action.backToSignIn')}
						</Link>
					</div>
				</AuthFormWrapper>
			);
	}
}

export default VerifyEmail;

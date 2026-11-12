/**
 * Signs in from a sign-in link (a magic link), on the device that asked for
 * it. Opened on another device it says so, and the link still works on the
 * right one. The link works once: opened again, it says the link is no
 * longer valid.
 *
 * With `storage: 'memory'` the verifier waited in localStorage, which every
 * tab of the origin shares, so the tab the link opens in signs in itself and
 * holds the session in its own memory.
 */
import { isBridgeError, type SignInStep, type WorkspaceChoice } from '@nebulr-group/bridge-auth-core';
import { useState, type HTMLAttributes, type ReactNode } from 'react';
import { getBridge, peekConfig } from '../../core/client.js';
import type { BridgeMessages } from '../../core/config.js';
import { takeEmailLink } from '../../core/email-link.js';
import { bounded, handOff, leave } from '../../core/finish-link.js';
import { errorMessage } from '../../core/i18n.js';
import { useBridgeRouter, useTranslator } from '../../react/hooks.js';
import { useMountOnce } from '../../react/once.js';
import { Alert } from '../shared/Alert.js';
import { AuthFormWrapper } from '../shared/AuthFormWrapper.js';
import { Link } from '../shared/Link.js';
import { Spinner } from '../shared/Spinner.js';
import { WorkspaceChooser } from './WorkspaceChooser.js';

export interface MagicLinkLandingProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onError'> {
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
	| { step: 'signed-in'; to: string }
	| { step: 'workspace'; workspaces: readonly WorkspaceChoice[]; choose: (id: string) => Promise<SignInStep> }
	| { step: 'failed'; message: string; kind: string | null };

export function MagicLinkLanding({ token, heading, onSignIn, onError, messages, ...rest }: MagicLinkLandingProps) {
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
		const kind = isBridgeError(error) ? error.kind : null;
		setView({ step: 'failed', message: kind === 'wrong-device' ? t('magicLink.wrongDevice') : errorMessage(error, t, 'link.error.invalid'), kind });
		onError?.(error);
	}

	async function follow(step: SignInStep) {
		if (handOff(step)) setView({ step: 'working' });
		else if (step.done) await finish();
		else setView({ step: 'workspace', workspaces: step.workspaces, choose: step.choose });
	}

	useMountOnce(() => {
		const found = token ?? takeEmailLink('magic-link');
		if (found === null) {
			setView({ step: 'failed', message: t('verify.missingLink'), kind: null });
			return;
		}
		bounded(getBridge().magicLink.finish(found)).then(follow).catch(fail);
	});

	async function choose(id: string) {
		if (view.step !== 'workspace') return;
		try {
			await follow(await view.choose(id));
		} catch (error) {
			fail(error);
		}
	}

	const pageHeading = heading === undefined ? t('login.heading') : heading;
	switch (view.step) {
		case 'working':
			return (
				<AuthFormWrapper heading={null} data-bridge-magic-link="working" {...rest}>
					<div className="bridge-auth-settling" data-bridge-auth-settling="">
						<Spinner size={24} />
						<span>{t('magicLink.finishing')}</span>
					</div>
				</AuthFormWrapper>
			);
		case 'signed-in':
			return (
				<AuthFormWrapper heading={pageHeading} data-bridge-magic-link="signed-in" {...rest}>
					<div className="bridge-form-footer">
						<Link href={view.to} className="bridge-link">
							{t('invite.continue')}
						</Link>
					</div>
				</AuthFormWrapper>
			);
		case 'workspace':
			return (
				<AuthFormWrapper heading={heading === undefined ? t('workspace.chooseHeading') : heading} data-bridge-magic-link="workspace" {...rest}>
					<WorkspaceChooser workspaces={view.workspaces} onChoose={choose} messages={messages} />
				</AuthFormWrapper>
			);
		case 'failed':
			return (
				<AuthFormWrapper heading={pageHeading} data-bridge-magic-link="failed" data-error-kind={view.kind ?? undefined} {...rest}>
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

export default MagicLinkLanding;

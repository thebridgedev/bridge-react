/**
 * Sets up a passkey from an emailed link, on the device that asked for it,
 * then signs the person in. The browser's dialog opens only on a click, as
 * Safari asks. Opened on another device it says so, and the link still works
 * on the right one. The link works once.
 */
import { isBridgeError, type SignInStep, type WorkspaceChoice } from '@nebulr-group/bridge-auth-core';
import { useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { getBridge, peekConfig } from '../../core/client.js';
import type { BridgeMessages } from '../../core/config.js';
import { takeEmailLink } from '../../core/email-link.js';
import { errorMessage } from '../../core/i18n.js';
import { useBridgeRouter, useTranslator } from '../../react/hooks.js';
import { useMountOnce } from '../../react/once.js';
import { Alert } from '../shared/Alert.js';
import { AuthFormWrapper } from '../shared/AuthFormWrapper.js';
import { Link } from '../shared/Link.js';
import { Spinner } from '../shared/Spinner.js';
import { WorkspaceChooser } from './WorkspaceChooser.js';

export interface PasskeySetupLandingProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onError'> {
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
	| { step: 'ready' }
	| { step: 'working' }
	| { step: 'unsupported' }
	| { step: 'workspace'; workspaces: readonly WorkspaceChoice[]; choose: (id: string) => Promise<SignInStep> }
	| { step: 'failed'; message: string; kind: string | null; again: boolean };

export function PasskeySetupLanding({ token, heading, onSignIn, onError, messages, ...rest }: PasskeySetupLandingProps) {
	const t = useTranslator(messages);
	const router = useBridgeRouter();
	const config = peekConfig();
	const authBase = config?.authBase ?? '/auth';
	const [view, setView] = useState<View>({ step: 'ready' });
	const found = useRef<string | null>(null);

	async function follow(step: SignInStep) {
		if (!step.done) {
			setView({ step: 'workspace', workspaces: step.workspaces, choose: step.choose });
			return;
		}
		if (onSignIn) onSignIn();
		else router.navigate(config?.afterSignIn ?? '/');
	}

	function fail(error: unknown) {
		const kind = isBridgeError(error) ? error.kind : null;
		const message = kind === 'wrong-device' ? t('magicLink.wrongDevice') : kind === 'cancelled' ? t('passkey.cancelled') : errorMessage(error, t, 'link.error.invalid');
		// A closed dialog leaves the link unused: the person may try again.
		setView({ step: 'failed', message, kind, again: kind === 'cancelled' });
		onError?.(error);
	}

	useMountOnce(async () => {
		found.current = token ?? takeEmailLink('passkey-setup');
		if (found.current === null) setView({ step: 'failed', message: t('verify.missingLink'), kind: null, again: false });
		else if (!(await getBridge().passkeys.supported())) setView({ step: 'unsupported' });
	});

	async function create() {
		if (found.current === null) return;
		setView({ step: 'working' });
		try {
			await follow(await getBridge().passkeys.setupLink.finish(found.current));
		} catch (error) {
			fail(error);
		}
	}

	async function choose(id: string) {
		if (view.step !== 'workspace') return;
		try {
			await follow(await view.choose(id));
		} catch (error) {
			fail(error);
		}
	}

	if (view.step === 'working') {
		return (
			<AuthFormWrapper heading={null} data-bridge-passkey-setup="working" {...rest}>
				<div className="bridge-auth-settling" data-bridge-auth-settling="">
					<Spinner size={24} />
					<span>{t('magicLink.finishing')}</span>
				</div>
			</AuthFormWrapper>
		);
	}
	if (view.step === 'workspace') {
		return (
			<AuthFormWrapper heading={heading === undefined ? t('workspace.chooseHeading') : heading} data-bridge-passkey-setup="workspace" {...rest}>
				<WorkspaceChooser workspaces={view.workspaces} onChoose={choose} messages={messages} />
			</AuthFormWrapper>
		);
	}
	return (
		<AuthFormWrapper
			heading={heading === undefined ? t('passkey.setupHeading') : heading}
			data-bridge-passkey-setup={view.step}
			data-error-kind={view.step === 'failed' ? (view.kind ?? undefined) : undefined}
			{...rest}
		>
			{view.step === 'unsupported' ? (
				<Alert variant="error">{t('passkey.unsupported')}</Alert>
			) : view.step === 'failed' ? (
				<Alert variant="error">{view.message}</Alert>
			) : (
				<p>{t('passkey.setupPrompt')}</p>
			)}
			{(view.step === 'ready' || (view.step === 'failed' && view.again)) && (
				<button type="button" className="bridge-btn bridge-btn-primary" data-bridge-passkey-create="" onClick={() => void create()}>
					{t('passkey.create')}
				</button>
			)}
			<div className="bridge-form-footer">
				<Link href={`${authBase}/sign-in`} className="bridge-link">
					{t('action.backToSignIn')}
				</Link>
			</div>
		</AuthFormWrapper>
	);
}

export default PasskeySetupLanding;

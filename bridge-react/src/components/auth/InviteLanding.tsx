/**
 * Where an invite email lands (`#bridge=invite&token=…`). It takes the token
 * from the address, clears it, and shows which workspace the invite is for:
 *
 * - a person with no account signs up from the invite: no email to verify,
 *   and they land signed in, in the workspace;
 * - a person with an account signs in, and the invite is accepted at once;
 * - someone signed in already accepts with one button.
 *
 * An invite that no longer works says why: revoked, used or expired. One
 * sent to another address says so, and offers to sign out. An issuer that
 * does not offer invites gets a plain "not offered here yet".
 */
import { isBridgeError, type InvitePreview } from '@nebulr-group/bridge-auth-core';
import { useState, type HTMLAttributes, type ReactNode } from 'react';
import { getBridge, peekConfig } from '../../core/client.js';
import type { BridgeMessages } from '../../core/config.js';
import { takeEmailLink } from '../../core/email-link.js';
import { errorMessage, type BridgeMessageKey } from '../../core/i18n.js';
import { useBridgeRouter, useTranslator, useUser } from '../../react/hooks.js';
import { useMountOnce } from '../../react/once.js';
import { Alert } from '../shared/Alert.js';
import { AuthFormWrapper } from '../shared/AuthFormWrapper.js';
import { Link } from '../shared/Link.js';
import { Spinner } from '../shared/Spinner.js';
import { SignInForm } from './SignInForm.js';
import { SignUpForm } from './SignUpForm.js';

export interface InviteLandingProps extends HTMLAttributes<HTMLDivElement> {
	/** The invite's token. @default read from the page's address */
	readonly token?: string;
	/** Replaces the page's heading. */
	readonly heading?: ReactNode;
	/** Called once the person is in the workspace. Without it, the page goes to `auth.afterSignIn`. */
	readonly onAccepted?: () => void;
	readonly messages?: BridgeMessages;
}

type Closed = Exclude<InvitePreview['state'], 'open'>;
type View =
	| { step: 'loading' }
	| { step: 'not-offered' }
	| { step: 'failed'; message: string }
	| { step: 'closed'; state: Closed }
	| { step: 'open'; token: string; workspace: string };

const CLOSED_COPY: Record<Closed, BridgeMessageKey> = {
	revoked: 'invite.state.revoked',
	used: 'invite.state.used',
	expired: 'invite.state.expired',
};
const CLOSED_CODES: Record<string, Closed> = { invite_revoked: 'revoked', invite_used: 'used', invite_expired: 'expired' };

function closedBy(error: unknown): Closed | null {
	return isBridgeError(error, 'link-invalid') && error.code !== null ? (CLOSED_CODES[error.code] ?? null) : null;
}

export function InviteLanding({ token, heading, onAccepted, messages, ...rest }: InviteLandingProps) {
	const t = useTranslator(messages);
	const router = useBridgeRouter();
	const user = useUser();
	const config = peekConfig();
	const authBase = config?.authBase ?? '/auth';

	const [view, setView] = useState<View>({ step: 'loading' });
	/** `auth`: the sign-up or sign-in form. `accept`: signed in, accepting or about to. */
	const [phase, setPhase] = useState<'auth' | 'accept'>('auth');
	const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-up');
	const [accepting, setAccepting] = useState(false);
	const [failure, setFailure] = useState<{ message: string; code: string | null } | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	useMountOnce(() => {
		const found = token ?? takeEmailLink('invite');
		if (found === null) {
			setView({ step: 'failed', message: t('verify.missingLink') });
			return;
		}
		const bridge = getBridge();
		bridge.invites
			.preview(found)
			.then((preview) => {
				if (preview.state !== 'open') {
					setView({ step: 'closed', state: preview.state });
					return;
				}
				setView({ step: 'open', token: found, workspace: preview.workspace.name ?? '' });
				setMode(preview.account ? 'sign-in' : 'sign-up');
				setPhase(bridge.session.get().status === 'signed-in' ? 'accept' : 'auth');
			})
			.catch((error: unknown) => {
				setView(isBridgeError(error, 'not-offered') ? { step: 'not-offered' } : { step: 'failed', message: errorMessage(error, t, 'link.error.invalid') });
			});
	});

	function done() {
		if (onAccepted) onAccepted();
		else router.navigate(config?.afterSignIn ?? '/');
	}

	/** What to say about a refused invite call: the server's code first. */
	function refusal(error: unknown): { message: string; code: string | null } {
		const code = isBridgeError(error) ? error.code : null;
		if (code === 'invite_for_another_address') return { message: t('invite.wrongAddress'), code };
		if (code === 'already_member') return { message: t('invite.alreadyMember'), code };
		if (code === 'account_exists') return { message: t('invite.accountExists'), code };
		return { message: errorMessage(error, t, 'link.error.invalid'), code };
	}

	async function accept() {
		if (view.step !== 'open' || accepting) return;
		setPhase('accept');
		setAccepting(true);
		setFailure(null);
		try {
			await getBridge().invites.accept(view.token);
			done();
		} catch (error) {
			const closed = closedBy(error);
			if (closed !== null) setView({ step: 'closed', state: closed });
			else setFailure(refusal(error));
		} finally {
			setAccepting(false);
		}
	}

	function signUpFailed(error: unknown) {
		const closed = closedBy(error);
		if (closed !== null) {
			setView({ step: 'closed', state: closed });
		} else if (isBridgeError(error) && error.code === 'account_exists') {
			// The address has an account after all: sign in, and the invite is accepted on the way.
			setMode('sign-in');
			setNotice(t('invite.accountExists'));
		}
	}

	async function signOut() {
		setFailure(null);
		await getBridge()
			.signOut()
			.catch(() => undefined);
		setPhase('auth');
		setMode('sign-in');
	}

	const named = (fallback: ReactNode) => (heading === undefined ? fallback : heading);

	if (view.step === 'loading') {
		return (
			<AuthFormWrapper heading={null} data-bridge-invite="loading" {...rest}>
				<div className="bridge-auth-settling" data-bridge-auth-settling="">
					<Spinner size={24} />
				</div>
			</AuthFormWrapper>
		);
	}
	if (view.step === 'not-offered') {
		return (
			<AuthFormWrapper heading={named(null)} data-bridge-invite="not-offered" {...rest}>
				<Alert variant="info">{t('invite.notOffered')}</Alert>
			</AuthFormWrapper>
		);
	}
	if (view.step === 'failed') {
		return (
			<AuthFormWrapper heading={named(null)} data-bridge-invite="failed" {...rest}>
				<Alert variant="error">{view.message}</Alert>
			</AuthFormWrapper>
		);
	}
	if (view.step === 'closed') {
		return (
			<AuthFormWrapper heading={named(null)} data-bridge-invite="closed" data-invite-state={view.state} {...rest}>
				<Alert variant={view.state === 'used' ? 'info' : 'error'}>{t(CLOSED_COPY[view.state])}</Alert>
				<div className="bridge-form-footer">
					<Link href={`${authBase}/sign-in`} className="bridge-link">
						{t('action.backToSignIn')}
					</Link>
				</div>
			</AuthFormWrapper>
		);
	}
	if (phase === 'accept') {
		return (
			<AuthFormWrapper
				heading={named(t('invite.heading', { workspace: view.workspace }))}
				description={view.workspace ? t('invite.description', { workspace: view.workspace }) : null}
				data-bridge-invite="accept"
				data-invite-error={failure?.code ?? undefined}
				{...rest}
			>
				{failure && <Alert variant="error">{failure.message}</Alert>}
				{failure?.code === 'invite_for_another_address' ? (
					<button type="button" className="bridge-btn bridge-btn-primary" onClick={() => void signOut()}>
						{t('action.signOut')}
					</button>
				) : failure?.code === 'already_member' ? (
					<button type="button" className="bridge-btn bridge-btn-primary" onClick={done}>
						{t('invite.continue')}
					</button>
				) : (
					<>
						{user?.email && (
							<p className="bridge-step-desc" data-bridge-invite-as="">
								{t('invite.signedInAs', { email: user.email })}
							</p>
						)}
						<button type="button" className="bridge-btn bridge-btn-primary" disabled={accepting} onClick={() => void accept()}>
							{accepting ? <Spinner size={16} /> : t('invite.accept')}
						</button>
					</>
				)}
			</AuthFormWrapper>
		);
	}
	return (
		<AuthFormWrapper
			heading={named(t('invite.heading', { workspace: view.workspace }))}
			description={mode === 'sign-up' ? t('invite.signUpToAccept') : t('invite.signInToAccept')}
			data-bridge-invite={mode}
			{...rest}
		>
			{notice && <Alert variant="info">{notice}</Alert>}
			{mode === 'sign-in' ? (
				<SignInForm
					heading={null}
					onSignIn={() => void accept()}
					messages={messages}
					footer={
						<div className="bridge-form-footer">
							{t('login.signupPrompt')}{' '}
							<button
								type="button"
								className="bridge-link"
								onClick={() => {
									setMode('sign-up');
									setNotice(null);
								}}
							>
								{t('login.signupLink')}
							</button>
						</div>
					}
				/>
			) : (
				<SignUpForm
					heading={null}
					invite={view.token}
					onSignIn={done}
					onError={signUpFailed}
					messages={messages}
					footer={
						<div className="bridge-form-footer">
							{t('signup.loginPrompt')}{' '}
							<button
								type="button"
								className="bridge-link"
								onClick={() => {
									setMode('sign-in');
									setNotice(null);
								}}
							>
								{t('signup.loginLink')}
							</button>
						</div>
					}
				/>
			)}
		</AuthFormWrapper>
	);
}

export default InviteLanding;

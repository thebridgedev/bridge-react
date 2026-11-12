/**
 * Sign in with email and password, or with a sign-in link sent by email (a
 * magic link), then pick a workspace when the person has several. On success
 * it calls `onSignIn`, or goes to the page the person was sent here from
 * (else `auth.afterSignIn`).
 *
 * The form shows the methods the app's sign-in options list: the password
 * fields when it offers passwords, "Email me a sign-in link" when it offers
 * links, and "Sign in with a passkey" when it offers passkeys and the browser
 * can use them. With passkeys, the email field also offers the person's
 * passkeys in its autofill list, where the browser supports it; the button
 * stays for a phone or a security key.
 *
 * Too many failed attempts: the form says how many minutes to wait, from
 * Bridge's answer.
 */
import { isBridgeError, readReturnTo, type SignInOptions, type SignInStep, type WorkspaceChoice } from '@nebulr-group/bridge-auth-core';
import { useEffect, useRef, useState, type FormEvent, type HTMLAttributes, type ReactNode } from 'react';
import { getBridge, peekConfig, takeEndedReason } from '../../core/client.js';
import type { BridgeMessages } from '../../core/config.js';
import { handOff } from '../../core/finish-link.js';
import { errorMessage } from '../../core/i18n.js';
import { useBridgeRouter, useTranslator } from '../../react/hooks.js';
import { useMountOnce } from '../../react/once.js';
import { Alert } from '../shared/Alert.js';
import { AuthFormWrapper } from '../shared/AuthFormWrapper.js';
import { Link } from '../shared/Link.js';
import { PasswordInput } from '../shared/PasswordInput.js';
import { Spinner } from '../shared/Spinner.js';
import { WorkspaceChooser } from './WorkspaceChooser.js';

export interface SignInFormProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onError'> {
	/** Heading on the credentials step: text or your own node. @default the shared "Log in to your account" copy; `null` for none */
	readonly heading?: ReactNode;
	/** Show the sign-up link. @default whether the app's sign-in options allow sign-up */
	readonly showSignupLink?: boolean;
	readonly signupHref?: string;
	readonly showForgotPassword?: boolean;
	readonly forgotPasswordHref?: string;
	/** Sign straight in to this workspace. */
	readonly workspace?: string;
	/** Called once signed in. Without it, the form goes to the return address. */
	readonly onSignIn?: () => void;
	readonly onError?: (error: unknown) => void;
	/** Replaces the sign-up line under the form. */
	readonly footer?: ReactNode;
	readonly messages?: BridgeMessages;
}

type Choice = { workspaces: readonly WorkspaceChoice[]; choose: (id: string) => Promise<SignInStep> };

export function SignInForm({
	heading,
	showSignupLink,
	signupHref,
	showForgotPassword = true,
	forgotPasswordHref,
	workspace,
	onSignIn,
	onError,
	footer,
	messages,
	...rest
}: SignInFormProps) {
	const t = useTranslator(messages);
	const router = useBridgeRouter();
	const config = peekConfig();
	const authBase = config?.authBase ?? '/auth';

	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [linkSent, setLinkSent] = useState(false);
	const [options, setOptions] = useState<SignInOptions | null>(null);
	const [choice, setChoice] = useState<Choice | null>(null);
	const [settled, setSettled] = useState(false);
	const [passkeySupported, setPasskeySupported] = useState(false);
	const [setupLinkSent, setSetupLinkSent] = useState(false);
	const autofillStarted = useRef(false);

	const signUpShown = showSignupLink ?? options?.signUp ?? true;
	const passwordOffered = options === null || options.methods.includes('password');
	const linkOffered = options !== null && options.methods.includes('magicLink');
	const passkeysOffered = passkeySupported && options !== null && options.methods.includes('passkeys');
	const emailAutocomplete = passkeysOffered ? 'username webauthn' : 'username';

	function finish() {
		setSettled(true);
		if (onSignIn) {
			onSignIn();
			return;
		}
		const back = readReturnTo(router.location.search, config?.returnToParam);
		router.navigate(back ?? config?.afterSignIn ?? '/');
	}

	function fail(error: unknown) {
		setFailure(errorMessage(error, t, 'login.error.invalidCredentials'));
		onError?.(error);
	}

	async function follow(step: SignInStep) {
		if (handOff(step)) setSettled(true);
		else if (step.done) finish();
		else setChoice({ workspaces: step.workspaces, choose: step.choose });
	}

	/** Waits for the person to pick a passkey from the email field's autofill list. A closed list is not an error. */
	async function startAutofill() {
		const bridge = getBridge();
		if (autofillStarted.current || !(await bridge.passkeys.autofillSupported())) return;
		autofillStarted.current = true;
		try {
			await follow(await bridge.passkeys.signIn({ autofill: true, ...(workspace ? { workspace } : {}) }));
		} catch (error) {
			if (!isBridgeError(error, 'cancelled')) fail(error);
		}
	}

	useMountOnce(() => {
		// Why the last session ended: told by the client as it happened, or read from the session on a fresh page.
		const bridge = getBridge();
		const now = bridge.session.get();
		const ended = takeEndedReason() ?? (now.status === 'signed-out' ? now.reason : null);
		if (ended === 'session-ended') setNotice(t('session.ended'));
		if (ended === 'access-removed') setNotice(t('session.accessRemoved'));
		bridge.signIn
			.options()
			.then(async (found) => {
				setOptions(found);
				if (!found.methods.includes('passkeys')) return;
				const supported = await bridge.passkeys.supported();
				setPasskeySupported(supported);
				if (supported) void startAutofill();
			})
			.catch(() => undefined);
	});

	// An autofill wait must not outlive the form.
	useEffect(
		() => () => {
			if (autofillStarted.current) void getBridge().passkeys.cancel();
		},
		[],
	);

	/** Signs in with a passkey from the browser's dialog: a phone, a security key, or this device. */
	async function signInWithPasskey() {
		if (loading) return;
		setFailure(null);
		setNotice(null);
		setLoading(true);
		try {
			await follow(await getBridge().passkeys.signIn({ ...(email.trim() ? { email: email.trim() } : {}), ...(workspace ? { workspace } : {}) }));
		} catch (error) {
			if (isBridgeError(error, 'cancelled')) setNotice(t('passkey.cancelled'));
			else fail(error);
		} finally {
			setLoading(false);
		}
	}

	/** Emails a link to set up a passkey on this device. The answer is the same whether or not the address has an account. */
	async function sendSetupLink() {
		if (loading || !email.trim()) return;
		setFailure(null);
		setLoading(true);
		try {
			await getBridge().passkeys.setupLink.request(email.trim());
			setSetupLinkSent(true);
		} catch (error) {
			fail(error);
		} finally {
			setLoading(false);
		}
	}

	async function submit(event: FormEvent) {
		event.preventDefault();
		if (loading) return;
		setFailure(null);
		setNotice(null);
		setLoading(true);
		try {
			await follow(await getBridge().signIn.start({ email: email.trim(), password, ...(workspace ? { workspace } : {}) }));
		} catch (error) {
			fail(error);
		} finally {
			setLoading(false);
		}
	}

	/** Asks for a sign-in link to the address typed. The answer is the same whether or not it has an account. */
	async function sendLink(event?: { preventDefault(): void }) {
		event?.preventDefault();
		if (loading || !email.trim()) return;
		setFailure(null);
		setNotice(null);
		setLoading(true);
		try {
			await getBridge().magicLink.start(email.trim());
			setLinkSent(true);
		} catch (error) {
			fail(error);
		} finally {
			setLoading(false);
		}
	}

	async function choose(id: string) {
		if (choice === null) return;
		try {
			await follow(await choice.choose(id));
		} catch (error) {
			setChoice(null);
			fail(error);
		}
	}

	if (settled) {
		return (
			<AuthFormWrapper heading={null} {...rest}>
				<div className="bridge-auth-settling" data-bridge-auth-settling="">
					<Spinner size={24} />
					<span>{t('login.submitting')}</span>
				</div>
			</AuthFormWrapper>
		);
	}

	if (choice) {
		return (
			<AuthFormWrapper heading={t('workspace.chooseHeading')} data-bridge-sign-in-step="workspace" {...rest}>
				<WorkspaceChooser workspaces={choice.workspaces} onChoose={choose} messages={messages} />
			</AuthFormWrapper>
		);
	}

	const emailField = (required: boolean) => (
		<div className="bridge-form-group">
			<label htmlFor="login-email">{t('field.email')}</label>
			<input
				id="login-email"
				type="email"
				autoComplete={emailAutocomplete}
				placeholder={t('placeholder.email')}
				required={required}
				value={email}
				onChange={(event) => setEmail(event.target.value)}
				disabled={loading}
			/>
		</div>
	);

	return (
		<AuthFormWrapper heading={heading === undefined ? t('login.heading') : heading} data-bridge-sign-in-step="credentials" {...rest}>
			{notice && <Alert variant="info">{notice}</Alert>}
			{failure && <Alert variant="error">{failure}</Alert>}
			{setupLinkSent ? (
				<Alert variant="info">{t('passkey.setupLinkSent')}</Alert>
			) : linkSent ? (
				<Alert variant="info">{t('magicLink.sent')}</Alert>
			) : passwordOffered ? (
				<form onSubmit={(event) => void submit(event)}>
					{emailField(true)}
					<div className="bridge-form-group">
						<label htmlFor="login-password">{t('field.password')}</label>
						<PasswordInput
							id="login-password"
							autoComplete="current-password"
							placeholder={t('placeholder.password')}
							required
							value={password}
							onValue={setPassword}
							disabled={loading}
							showLabel={t('action.showPassword')}
							hideLabel={t('action.hidePassword')}
						/>
					</div>
					<button type="submit" className="bridge-btn bridge-btn-primary" disabled={loading || !email.trim() || !password}>
						{loading ? (
							<>
								<Spinner size={16} /> {t('login.submitting')}
							</>
						) : (
							t('login.submit')
						)}
					</button>
					{showForgotPassword && (
						<div className="bridge-forgot-row">
							<Link href={forgotPasswordHref ?? `${authBase}/forgot-password`} className="bridge-link">
								{t('login.forgotPassword')}
							</Link>
						</div>
					)}
					{linkOffered && (
						<>
							<div className="bridge-divider" data-bridge-sign-in-or="">
								{t('magicLink.or')}
							</div>
							<button type="button" className="bridge-btn bridge-btn-secondary" data-bridge-magic-link-send="" onClick={(event) => void sendLink(event)} disabled={loading || !email.trim()}>
								{t('magicLink.send')}
							</button>
						</>
					)}
				</form>
			) : linkOffered ? (
				<form onSubmit={(event) => void sendLink(event)} data-bridge-magic-link-form="">
					{emailField(true)}
					<button type="submit" className="bridge-btn bridge-btn-primary" data-bridge-magic-link-send="" disabled={loading || !email.trim()}>
						{loading && <Spinner size={16} />} {t('magicLink.send')}
					</button>
				</form>
			) : passkeysOffered ? (
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void signInWithPasskey();
					}}
					data-bridge-passkey-form=""
				>
					{emailField(false)}
				</form>
			) : null}

			{passkeysOffered && !linkSent && !setupLinkSent && (
				<>
					{(passwordOffered || linkOffered) && (
						<div className="bridge-divider" data-bridge-sign-in-or="">
							{t('magicLink.or')}
						</div>
					)}
					<button
						type="button"
						className={`bridge-btn ${passwordOffered || linkOffered ? 'bridge-btn-secondary' : 'bridge-btn-primary'}`}
						data-bridge-passkey-sign-in=""
						onClick={() => void signInWithPasskey()}
						disabled={loading}
					>
						{t('passkey.signIn')}
					</button>
					<div className="bridge-forgot-row">
						<button type="button" className="bridge-link" data-bridge-passkey-setup-link="" onClick={() => void sendSetupLink()} disabled={loading || !email.trim()}>
							{t('passkey.setupLinkSend')}
						</button>
					</div>
				</>
			)}

			{footer !== undefined
				? footer
				: signUpShown && (
						<div className="bridge-form-footer">
							{t('login.signupPrompt')}{' '}
							<Link href={signupHref ?? `${authBase}/sign-up`} className="bridge-link">
								{t('login.signupLink')}
							</Link>
						</div>
					)}
		</AuthFormWrapper>
	);
}

export default SignInForm;

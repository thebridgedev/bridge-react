/**
 * Sign up with email and password. Nothing is made until the person proves
 * the address: Bridge emails a link to the app's verify-email page, which
 * finishes the sign-up on this device. The answer is the same whether or not
 * the address already has an account, so the form never says which.
 *
 * With `invite`, it signs the person up from an invite instead: the invite's
 * link proved the address, so there is no email field and no email to wait
 * for, and the person lands signed in, in the inviting workspace.
 */
import type { SignInOptions } from '@nebulr-group/bridge-auth-core';
import { useEffect, useRef, useState, type FormEvent, type HTMLAttributes, type ReactNode } from 'react';
import { getBridge, peekConfig } from '../../core/client.js';
import type { BridgeMessages } from '../../core/config.js';
import { errorMessage } from '../../core/i18n.js';
import { takeSignUpLinks } from '../../core/link-relay.js';
import { useBridgeRouter, useTranslator } from '../../react/hooks.js';
import { useMountOnce } from '../../react/once.js';
import { Alert } from '../shared/Alert.js';
import { AuthFormWrapper } from '../shared/AuthFormWrapper.js';
import { Link } from '../shared/Link.js';
import { PasswordInput } from '../shared/PasswordInput.js';
import { Spinner } from '../shared/Spinner.js';

export interface SignUpFormProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onError'> {
	/** Heading: text or your own node. @default the shared sign-up copy; `null` for none */
	readonly heading?: ReactNode;
	/** Ask for first and last name. @default true */
	readonly showNameFields?: boolean;
	/**
	 * The new person's own workspace: `true` makes one with no name yet,
	 * `'ask'` asks for its name, `false` makes none. @default true
	 */
	readonly workspace?: boolean | 'ask';
	/**
	 * An invite's token: sign the person up from the invite. The address is
	 * the invite's, so no email field is shown and no email is sent.
	 */
	readonly invite?: string;
	/** With `invite`: called once signed in. Without it, the page goes to `auth.afterSignIn`. */
	readonly onSignIn?: () => void;
	readonly showLoginLink?: boolean;
	readonly loginHref?: string;
	/** Called once the email is sent. */
	readonly onSent?: (email: string) => void;
	readonly onError?: (error: unknown) => void;
	readonly footer?: ReactNode;
	readonly messages?: BridgeMessages;
}

export function SignUpForm({
	heading,
	showNameFields = true,
	workspace = true,
	invite,
	onSignIn,
	showLoginLink = true,
	loginHref,
	onSent,
	onError,
	footer,
	messages,
	...rest
}: SignUpFormProps) {
	const t = useTranslator(messages);
	const router = useBridgeRouter();
	const config = peekConfig();
	const authBase = config?.authBase ?? '/auth';

	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const [workspaceName, setWorkspaceName] = useState('');
	const [loading, setLoading] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);
	const [sentTo, setSentTo] = useState<string | null>(null);
	const [options, setOptions] = useState<SignInOptions | null>(null);
	const stopRelay = useRef<(() => void) | null>(null);

	const minLength = options?.password?.minLength ?? 8;
	/** An app that offers sign-in links only takes no password: the person signs in by link. */
	const passwordOffered = options === null || options.methods.includes('password');
	// An invite is its own way in, whether or not the app takes sign-ups.
	const closed = !invite && options !== null && !options.signUp;

	useEffect(
		() => () => {
			stopRelay.current?.();
			stopRelay.current = null;
		},
		[],
	);

	useMountOnce(() => {
		getBridge()
			.signIn.options()
			.then(setOptions)
			.catch(() => undefined);
	});

	async function submit(event: FormEvent) {
		event.preventDefault();
		if (loading) return;
		setFailure(null);
		if (passwordOffered && password.length < minLength) {
			setFailure(t('password.tooShort', { count: minLength }));
			return;
		}
		setLoading(true);
		const secret = passwordOffered ? { password } : {};
		const address = email.trim();
		const names = {
			...(firstName.trim() ? { firstName: firstName.trim() } : {}),
			...(lastName.trim() ? { lastName: lastName.trim() } : {}),
		};
		try {
			if (invite) {
				// Signed in at once, in the inviting workspace: the invite's link proved the address.
				await getBridge().invites.signUp({ token: invite, ...secret, ...names });
				if (onSignIn) onSignIn();
				else router.navigate(config?.afterSignIn ?? '/');
				return;
			}
			await getBridge().signUp.start({
				email: address,
				...secret,
				...names,
				...(workspace === 'ask' ? { workspace: workspaceName.trim() || true } : workspace ? { workspace: true } : {}),
			});
			setSentTo(address);
			onSent?.(address);
			// Memory only: this tab holds the sign-up's verifier, and the email link opens in a new tab, which hands it here.
			if (config?.storage === 'memory' && stopRelay.current === null) {
				stopRelay.current = takeSignUpLinks(config.issuer, () => router.navigate(`${authBase}/verify-email`));
			}
		} catch (error) {
			setFailure(errorMessage(error, t, 'signup.error.create'));
			onError?.(error);
		} finally {
			setLoading(false);
		}
	}

	const shownHeading = heading === undefined ? t('signup.heading') : heading;

	if (sentTo !== null) {
		return (
			<AuthFormWrapper
				heading={t('signup.successHeading')}
				description={
					<p className="bridge-step-desc" data-bridge-sign-up-sent="">
						{t('signup.successDescription', { email: sentTo })}
					</p>
				}
				data-bridge-sign-up-step="sent"
				{...rest}
			/>
		);
	}

	if (closed) {
		return (
			<AuthFormWrapper heading={shownHeading} data-bridge-sign-up-step="closed" {...rest}>
				<Alert variant="info">{t('signup.closed')}</Alert>
				<div className="bridge-form-footer">
					<Link href={loginHref ?? `${authBase}/sign-in`} className="bridge-link">
						{t('action.backToSignIn')}
					</Link>
				</div>
			</AuthFormWrapper>
		);
	}

	return (
		<AuthFormWrapper heading={shownHeading} data-bridge-sign-up-step="form" {...rest}>
			{failure && <Alert variant="error">{failure}</Alert>}
			<form onSubmit={(event) => void submit(event)}>
				{showNameFields && (
					<div className="bridge-form-row">
						<div className="bridge-form-group">
							<label htmlFor="signup-first-name">{t('field.firstName')}</label>
							<input id="signup-first-name" type="text" autoComplete="given-name" placeholder={t('placeholder.firstName')} value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={loading} />
						</div>
						<div className="bridge-form-group">
							<label htmlFor="signup-last-name">{t('field.lastName')}</label>
							<input id="signup-last-name" type="text" autoComplete="family-name" placeholder={t('placeholder.lastName')} value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={loading} />
						</div>
					</div>
				)}
				{!invite && (
					<div className="bridge-form-group">
						<label htmlFor="signup-email">{t('field.email')}</label>
						<input id="signup-email" type="email" autoComplete="email" placeholder={t('placeholder.email')} required value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
					</div>
				)}
				{passwordOffered && (
					<div className="bridge-form-group">
						<label htmlFor="signup-password">{t('field.password')}</label>
						<PasswordInput
							id="signup-password"
							autoComplete="new-password"
							placeholder={t('placeholder.newPassword')}
							required
							minLength={minLength}
							value={password}
							onValue={setPassword}
							disabled={loading}
							showLabel={t('action.showPassword')}
							hideLabel={t('action.hidePassword')}
						/>
					</div>
				)}
				{workspace === 'ask' && !invite && (
					<div className="bridge-form-group">
						<label htmlFor="signup-workspace">{t('field.workspaceName')}</label>
						<input id="signup-workspace" type="text" autoComplete="organization" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} disabled={loading} />
					</div>
				)}
				<button type="submit" className="bridge-btn bridge-btn-primary" disabled={loading || (!invite && !email.trim()) || (passwordOffered && !password)}>
					{loading ? <Spinner size={16} /> : t('signup.submit')}
				</button>
			</form>
			{footer !== undefined
				? footer
				: showLoginLink && (
						<div className="bridge-form-footer">
							{t('signup.loginPrompt')}{' '}
							<Link href={loginHref ?? `${authBase}/sign-in`} className="bridge-link">
								{t('signup.loginLink')}
							</Link>
						</div>
					)}
		</AuthFormWrapper>
	);
}

export default SignUpForm;

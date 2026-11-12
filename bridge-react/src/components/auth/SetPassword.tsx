/**
 * Sets a new password from a reset link. It signs nobody in and ends every
 * session of the account, so the page goes on to sign-in.
 */
import { useState, type FormEvent, type HTMLAttributes, type ReactNode } from 'react';
import { getBridge, peekConfig } from '../../core/client.js';
import type { BridgeMessages } from '../../core/config.js';
import { takeEmailLink } from '../../core/email-link.js';
import { errorMessage } from '../../core/i18n.js';
import { useTranslator } from '../../react/hooks.js';
import { useMountOnce } from '../../react/once.js';
import { Alert } from '../shared/Alert.js';
import { AuthFormWrapper } from '../shared/AuthFormWrapper.js';
import { Link } from '../shared/Link.js';
import { PasswordInput } from '../shared/PasswordInput.js';
import { Spinner } from '../shared/Spinner.js';

export interface SetPasswordProps extends HTMLAttributes<HTMLDivElement> {
	/** The reset link's token. @default read from the page's address */
	readonly token?: string;
	/** Heading: text or your own node. `null` for none. */
	readonly heading?: ReactNode;
	readonly loginHref?: string;
	readonly onDone?: () => void;
	readonly messages?: BridgeMessages;
}

export function SetPassword({ token, heading, loginHref, onDone, messages, ...rest }: SetPasswordProps) {
	const t = useTranslator(messages);
	const authBase = peekConfig()?.authBase ?? '/auth';
	const [linkToken, setLinkToken] = useState<string | null>(null);
	const [checked, setChecked] = useState(false);
	const [password, setPassword] = useState('');
	const [confirm, setConfirm] = useState('');
	const [minLength, setMinLength] = useState(8);
	const [loading, setLoading] = useState(false);
	const [done, setDone] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);

	useMountOnce(() => {
		setLinkToken(token ?? takeEmailLink('reset-password'));
		setChecked(true);
		getBridge()
			.signIn.options()
			.then((found) => {
				if (found.password?.minLength !== undefined) setMinLength(found.password.minLength);
			})
			.catch(() => undefined);
	});

	async function submit(event: FormEvent) {
		event.preventDefault();
		if (loading || linkToken === null) return;
		setFailure(null);
		if (password !== confirm) {
			setFailure(t('forgot.error.mismatch'));
			return;
		}
		if (password.length < minLength) {
			setFailure(t('password.tooShort', { count: minLength }));
			return;
		}
		setLoading(true);
		try {
			await getBridge().password.set(linkToken, password);
			setDone(true);
			onDone?.();
		} catch (error) {
			setFailure(errorMessage(error, t, 'forgot.error.update'));
		} finally {
			setLoading(false);
		}
	}

	if (done) {
		return (
			<AuthFormWrapper heading={t('forgot.successHeading')} description={t('forgot.setDone')} data-bridge-set-password="done" {...rest}>
				<Link href={loginHref ?? `${authBase}/sign-in`} className="bridge-btn bridge-btn-primary">
					{t('login.submit')}
				</Link>
			</AuthFormWrapper>
		);
	}
	if (checked && linkToken === null) {
		return (
			<AuthFormWrapper heading={t('forgot.headingSet')} data-bridge-set-password="missing" {...rest}>
				<Alert variant="error">{t('verify.missingLink')}</Alert>
				<div className="bridge-form-footer">
					<Link href={`${authBase}/forgot-password`} className="bridge-link">
						{t('login.forgotPassword')}
					</Link>
				</div>
			</AuthFormWrapper>
		);
	}
	return (
		<AuthFormWrapper heading={heading === undefined ? t('forgot.headingSet') : heading} data-bridge-set-password="form" {...rest}>
			{failure && <Alert variant="error">{failure}</Alert>}
			<form onSubmit={(event) => void submit(event)}>
				<div className="bridge-form-group">
					<label htmlFor="set-password">{t('field.newPassword')}</label>
					<PasswordInput
						id="set-password"
						autoComplete="new-password"
						placeholder={t('placeholder.newPassword')}
						required
						value={password}
						onValue={setPassword}
						disabled={loading || !checked}
						showLabel={t('action.showPassword')}
						hideLabel={t('action.hidePassword')}
					/>
				</div>
				<div className="bridge-form-group">
					<label htmlFor="set-password-confirm">{t('field.confirmPassword')}</label>
					<PasswordInput
						id="set-password-confirm"
						autoComplete="new-password"
						placeholder={t('placeholder.confirmPassword')}
						required
						value={confirm}
						onValue={setConfirm}
						disabled={loading || !checked}
						showLabel={t('action.showPassword')}
						hideLabel={t('action.hidePassword')}
					/>
				</div>
				<button type="submit" className="bridge-btn bridge-btn-primary" disabled={loading || !checked || !password || !confirm}>
					{loading ? <Spinner size={16} /> : t('forgot.setSubmit')}
				</button>
			</form>
			<div className="bridge-form-footer">
				<Link href={loginHref ?? `${authBase}/sign-in`} className="bridge-link">
					{t('action.backToSignIn')}
				</Link>
			</div>
		</AuthFormWrapper>
	);
}

export default SetPassword;

/**
 * Asks for a reset link. Bridge answers the same whether or not the address
 * has an account, so the page always says the email is on its way.
 */
import { useState, type FormEvent, type HTMLAttributes, type ReactNode } from 'react';
import { getBridge, peekConfig } from '../../core/client.js';
import type { BridgeMessages } from '../../core/config.js';
import { errorMessage } from '../../core/i18n.js';
import { useTranslator } from '../../react/hooks.js';
import { Alert } from '../shared/Alert.js';
import { AuthFormWrapper } from '../shared/AuthFormWrapper.js';
import { Link } from '../shared/Link.js';
import { Spinner } from '../shared/Spinner.js';

export interface ForgotPasswordProps extends HTMLAttributes<HTMLDivElement> {
	/** Heading: text or your own node. `null` for none. */
	readonly heading?: ReactNode;
	/** The line under the heading. `null` for none. */
	readonly description?: ReactNode;
	readonly loginHref?: string;
	readonly onSent?: (email: string) => void;
	readonly messages?: BridgeMessages;
}

export function ForgotPassword({ heading, description, loginHref, onSent, messages, ...rest }: ForgotPasswordProps) {
	const t = useTranslator(messages);
	const authBase = peekConfig()?.authBase ?? '/auth';
	const [email, setEmail] = useState('');
	const [loading, setLoading] = useState(false);
	const [sent, setSent] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);

	async function submit(event: FormEvent) {
		event.preventDefault();
		if (loading) return;
		setFailure(null);
		setLoading(true);
		try {
			await getBridge().password.forgot(email.trim());
			setSent(true);
			onSent?.(email.trim());
		} catch (error) {
			setFailure(errorMessage(error, t, 'forgot.error.send'));
		} finally {
			setLoading(false);
		}
	}

	return (
		<AuthFormWrapper
			heading={sent ? null : heading === undefined ? t('forgot.headingRequest') : heading}
			description={sent ? null : description === undefined ? t('forgot.description') : description}
			data-bridge-forgot-password={sent ? 'sent' : 'form'}
			{...rest}
		>
			{failure && <Alert variant="error">{failure}</Alert>}
			{sent ? (
				<Alert variant="success">{t('forgot.emailSent')}</Alert>
			) : (
				<form onSubmit={(event) => void submit(event)}>
					<div className="bridge-form-group">
						<label htmlFor="forgot-email">{t('field.email')}</label>
						<input id="forgot-email" type="email" autoComplete="email" placeholder={t('placeholder.email')} required value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
					</div>
					<button type="submit" className="bridge-btn bridge-btn-primary" disabled={loading || !email.trim()}>
						{loading ? <Spinner size={16} /> : t('forgot.submit')}
					</button>
				</form>
			)}
			<div className="bridge-form-footer">
				<Link href={loginHref ?? `${authBase}/sign-in`} className="bridge-link">
					{t('action.backToSignIn')}
				</Link>
			</div>
		</AuthFormWrapper>
	);
}

export default ForgotPassword;

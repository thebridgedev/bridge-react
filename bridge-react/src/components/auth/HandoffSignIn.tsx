/**
 * Hand-off mode: signs the person in for a program on their own machine, such
 * as a command-line tool, and sends the code back to the program's loopback
 * address. The program trades the code with its own verifier; no token ever
 * reaches this page, and this page's own session is not touched.
 *
 * It renders only when the config has `handoff: { loopback: true }`, and it
 * refuses any request whose return address is not
 * `http://127.0.0.1:<port>/callback` or `http://[::1]:<port>/callback`.
 */
import { useState, type FormEvent, type HTMLAttributes, type ReactNode } from 'react';
import { getBridge, peekConfig } from '../../core/client.js';
import type { BridgeMessages } from '../../core/config.js';
import { handoffSignIn, readHandoff, returnToProgram, type HandoffState } from '../../core/handoff.js';
import { errorMessage } from '../../core/i18n.js';
import { useBridgeRouter, useTranslator } from '../../react/hooks.js';
import { useMountOnce } from '../../react/once.js';
import { Alert } from '../shared/Alert.js';
import { AuthFormWrapper } from '../shared/AuthFormWrapper.js';
import { PasswordInput } from '../shared/PasswordInput.js';
import { Spinner } from '../shared/Spinner.js';
import { WorkspaceChooser } from './WorkspaceChooser.js';

export interface HandoffSignInProps extends HTMLAttributes<HTMLDivElement> {
	/** The program's name, for the copy. @default the config's `handoff.program` */
	readonly program?: string;
	/** Replaces the page's heading. */
	readonly heading?: ReactNode;
	/** Called with the address the browser is about to go to. */
	readonly onDone?: (returnUrl: string) => void;
	readonly messages?: BridgeMessages;
}

export function HandoffSignIn({ program, heading, onDone, messages, ...rest }: HandoffSignInProps) {
	const t = useTranslator(messages);
	const router = useBridgeRouter();
	const handoff = peekConfig()?.handoff ?? null;
	const name = program ?? handoff?.program ?? '';

	const [view, setView] = useState<HandoffState | null>(null);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);

	useMountOnce(() => {
		setView(readHandoff(router.location.search));
	});

	function settle(next: HandoffState) {
		setView(next);
		if (next.status === 'done') {
			onDone?.(next.returnUrl);
			returnToProgram(next);
		}
	}

	async function submit(event: FormEvent) {
		event.preventDefault();
		if (loading || view?.status !== 'ready') return;
		setFailure(null);
		setLoading(true);
		try {
			settle(await handoffSignIn(getBridge(), view.request, { email: email.trim(), password }));
		} catch (error) {
			setFailure(errorMessage(error, t, 'login.error.invalidCredentials'));
		} finally {
			setLoading(false);
		}
	}

	async function choose(id: string) {
		if (view?.status !== 'workspace') return;
		try {
			settle(await view.choose(id));
		} catch (error) {
			setFailure(errorMessage(error, t, 'workspace.error.select'));
		}
	}

	const pageHeading = heading === undefined ? t('handoff.heading', { program: name }) : heading;

	if (handoff === null) {
		return (
			<AuthFormWrapper heading={null} data-bridge-handoff="not-offered" {...rest}>
				<Alert variant="info">{t('handoff.notOffered')}</Alert>
			</AuthFormWrapper>
		);
	}
	if (view === null) {
		return (
			<AuthFormWrapper heading={null} data-bridge-handoff="loading" {...rest}>
				<div className="bridge-auth-settling" data-bridge-auth-settling="">
					<Spinner size={24} />
				</div>
			</AuthFormWrapper>
		);
	}
	if (view.status === 'invalid') {
		return (
			<AuthFormWrapper heading={pageHeading} data-bridge-handoff="invalid" {...rest}>
				<Alert variant="error">{t('handoff.invalid', { program: name })}</Alert>
			</AuthFormWrapper>
		);
	}
	if (view.status === 'done') {
		return (
			<AuthFormWrapper heading={pageHeading} data-bridge-handoff="done" {...rest}>
				<Alert variant="success">{t('handoff.done', { program: name })}</Alert>
			</AuthFormWrapper>
		);
	}
	if (view.status === 'workspace') {
		return (
			<AuthFormWrapper heading={t('workspace.chooseHeading')} data-bridge-handoff="workspace" {...rest}>
				{failure && <Alert variant="error">{failure}</Alert>}
				<WorkspaceChooser workspaces={view.workspaces} onChoose={choose} messages={messages} />
			</AuthFormWrapper>
		);
	}
	return (
		<AuthFormWrapper heading={pageHeading} data-bridge-handoff="form" {...rest}>
			{failure && <Alert variant="error">{failure}</Alert>}
			<form onSubmit={(event) => void submit(event)}>
				<div className="bridge-form-group">
					<label htmlFor="handoff-email">{t('field.email')}</label>
					<input id="handoff-email" type="email" autoComplete="username" placeholder={t('placeholder.email')} required value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} />
				</div>
				<div className="bridge-form-group">
					<label htmlFor="handoff-password">{t('field.password')}</label>
					<PasswordInput
						id="handoff-password"
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
			</form>
		</AuthFormWrapper>
	);
}

export default HandoffSignIn;

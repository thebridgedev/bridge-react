/**
 * The signed-in person's passkeys: each one's name, when it was added and
 * last used, and whether it syncs to their other devices; adding one from
 * this device and removing one. Adding or removing needs a recent sign-in;
 * otherwise the person is asked to sign in again. The last way to sign in
 * cannot be removed.
 */
import { isBridgeError, type PasskeyInfo } from '@nebulr-group/bridge-auth-core';
import { useState, type FormEvent, type HTMLAttributes, type ReactNode } from 'react';
import { getBridge } from '../../core/client.js';
import type { BridgeMessages } from '../../core/config.js';
import { errorMessage } from '../../core/i18n.js';
import { useTranslator } from '../../react/hooks.js';
import { useMountOnce } from '../../react/once.js';
import { Alert } from '../shared/Alert.js';
import { Spinner } from '../shared/Spinner.js';

export interface PasskeyManagerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'onError'> {
	/** Heading above the list. @default "Passkeys"; `null` for none */
	readonly heading?: ReactNode;
	/** Called after a passkey was added or removed. */
	readonly onChange?: (passkeys: readonly PasskeyInfo[]) => void;
	readonly onError?: (error: unknown) => void;
	readonly messages?: BridgeMessages;
}

const date = (value: string | null) => (value === null ? '' : new Date(value).toLocaleDateString());

export function PasskeyManager({ heading, onChange, onError, messages, className, ...rest }: PasskeyManagerProps) {
	const t = useTranslator(messages);
	const [passkeys, setPasskeys] = useState<readonly PasskeyInfo[] | null>(null);
	const [supported, setSupported] = useState(false);
	const [name, setName] = useState('');
	const [busy, setBusy] = useState(false);
	const [failure, setFailure] = useState<string | null>(null);

	function fail(error: unknown) {
		if (isBridgeError(error, 'cancelled')) setFailure(t('passkey.cancelled'));
		else if (isBridgeError(error, 'reauthenticate')) setFailure(t('passkey.reauthenticate'));
		else if (isBridgeError(error, 'conflict') && error.code === 'last_sign_in_method') setFailure(t('passkey.lastMethod'));
		else if (isBridgeError(error, 'conflict') && error.code === 'passkey_exists') setFailure(t('passkey.exists'));
		else setFailure(errorMessage(error, t));
		onError?.(error);
	}

	async function load(): Promise<readonly PasskeyInfo[]> {
		const list = await getBridge().passkeys.list();
		setPasskeys(list);
		return list;
	}

	useMountOnce(async () => {
		setSupported(await getBridge().passkeys.supported());
		await load().catch(fail);
	});

	async function add(event: FormEvent) {
		event.preventDefault();
		if (busy) return;
		setBusy(true);
		setFailure(null);
		try {
			await getBridge().passkeys.add(name.trim() || undefined);
			setName('');
			onChange?.(await load());
		} catch (error) {
			fail(error);
		} finally {
			setBusy(false);
		}
	}

	async function remove(id: string) {
		if (busy) return;
		setBusy(true);
		setFailure(null);
		try {
			await getBridge().passkeys.remove(id);
			onChange?.(await load());
		} catch (error) {
			fail(error);
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className={`bridge-passkeys ${className ?? ''}`} data-bridge-passkeys="" {...rest}>
			{heading !== null && (typeof heading === 'string' || heading === undefined ? <h3>{heading ?? t('passkey.manageHeading')}</h3> : heading)}
			{failure && <Alert variant="error">{failure}</Alert>}
			{passkeys === null ? (
				<Spinner size={16} />
			) : passkeys.length === 0 ? (
				<p data-bridge-passkeys-empty="">{t('passkey.empty')}</p>
			) : (
				<ul className="bridge-passkey-list">
					{passkeys.map((passkey) => (
						<li key={passkey.id} data-bridge-passkey={passkey.id}>
							<div>
								<strong>{passkey.name}</strong>
								<div className="bridge-passkey-meta">
									{t('passkey.added', { date: date(passkey.createdAt) })}
									{passkey.lastUsedAt && ` · ${t('passkey.lastUsed', { date: date(passkey.lastUsedAt) })}`}
									{passkey.deviceType === 'multiDevice' && ` · ${t('passkey.synced')}`}
								</div>
							</div>
							<button type="button" className="bridge-btn bridge-btn-secondary" data-bridge-passkey-remove="" onClick={() => void remove(passkey.id)} disabled={busy}>
								{t('passkey.remove')}
							</button>
						</li>
					))}
				</ul>
			)}
			{supported ? (
				<form onSubmit={(event) => void add(event)} className="bridge-passkey-add">
					<input type="text" maxLength={64} placeholder={t('passkey.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
					<button type="submit" className="bridge-btn bridge-btn-primary" data-bridge-passkey-add="" disabled={busy}>
						{busy && <Spinner size={16} />} {t('passkey.add')}
					</button>
				</form>
			) : (
				<p>{t('passkey.unsupported')}</p>
			)}
		</div>
	);
}

export default PasskeyManager;

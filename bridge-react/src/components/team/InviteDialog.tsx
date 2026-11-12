/**
 * Invites one person by email, with a role the inviter may give. Inviting an
 * address that already has an invite sends a new one; the old link stops
 * working. Bridge enforces any limit; a refusal shows its message here.
 */
import type { Invite, Role } from '@nebulr-group/bridge-auth-core';
import { useEffect, useRef, useState, type DialogHTMLAttributes, type ReactNode } from 'react';
import { getBridge } from '../../core/client.js';
import { errorMessage } from '../../core/i18n.js';
import { useTranslator } from '../../react/hooks.js';
import { Alert } from '../shared/Alert.js';
import type { DialogActions } from './ConfirmDialog.js';

export interface InviteDialogProps extends Omit<DialogHTMLAttributes<HTMLDialogElement>, 'open' | 'title' | 'onClose'> {
	readonly open?: boolean;
	readonly onClose?: () => void;
	readonly onInvited?: (invite: Invite) => void;
	/** Replaces the title and subtitle. */
	readonly title?: ReactNode;
	/** Replaces the Cancel and Send buttons. */
	readonly actions?: (actions: DialogActions) => ReactNode;
}

export function InviteDialog({ open = false, onClose, onInvited, title, actions, ...rest }: InviteDialogProps) {
	const t = useTranslator();
	const dialog = useRef<HTMLDialogElement>(null);
	const [email, setEmail] = useState('');
	const [role, setRole] = useState('');
	const [roles, setRoles] = useState<Role[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const hasDefault = roles.some((r) => r.isDefault);

	useEffect(() => {
		const element = dialog.current;
		if (!element || typeof element.showModal !== 'function') return;
		if (open && !element.open) {
			reset();
			element.showModal();
		} else if (!open && element.open) {
			element.close();
		}
	}, [open]);

	function reset() {
		setEmail('');
		setRole('');
		setRoles([]);
		setError(null);
		void loadRoles();
	}

	async function loadRoles() {
		try {
			const found = await getBridge().team.roles.list({ assignable: true });
			setRoles(found);
			setRole(found.find((r) => r.isDefault)?.key ?? '');
		} catch (err) {
			setError(errorMessage(err, t));
		}
	}

	async function submit() {
		const address = email.trim();
		if (address === '') {
			setError('Please enter an email address.');
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const invite = await getBridge().team.invites.create(role ? { email: address, role } : { email: address });
			onInvited?.(invite);
			onClose?.();
		} catch (err) {
			setError(errorMessage(err, t));
		} finally {
			setLoading(false);
		}
	}

	return (
		<dialog ref={dialog} data-bridge-team-dialog="" onClose={() => onClose?.()} {...rest}>
			<div className="bridge-team-dialog-content">
				{title !== undefined ? (
					title
				) : (
					<>
						<h3 className="bridge-team-dialog-title">Add Team Member</h3>
						<p className="bridge-team-dialog-subtitle">They get an email with a link to join.</p>
					</>
				)}

				{error && (
					<div className="bridge-team-dialog-error">
						<Alert variant="error">{error}</Alert>
					</div>
				)}

				<form
					onSubmit={(e) => {
						e.preventDefault();
						void submit();
					}}
				>
					<div className="bridge-team-form-group">
						<label htmlFor="bridge-add-emails">Email address</label>
						<input
							id="bridge-add-emails"
							type="email"
							autoComplete="off"
							placeholder="name@example.com"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							disabled={loading}
						/>
					</div>

					{roles.length > 0 && (
						<div className="bridge-team-form-group">
							<label htmlFor="bridge-invite-role">Role</label>
							<select id="bridge-invite-role" value={role} onChange={(e) => setRole(e.target.value)} disabled={loading}>
								{!hasDefault && <option value="">Default role</option>}
								{roles.map((r) => (
									<option key={r.key} value={r.key}>
										{r.name}
									</option>
								))}
							</select>
						</div>
					)}
				</form>

				{actions ? (
					actions({ loading, onConfirm: () => void submit(), onCancel: onClose })
				) : (
					<div className="bridge-team-dialog-actions">
						<button type="button" className="bridge-btn bridge-btn-secondary" onClick={() => onClose?.()} disabled={loading}>
							Cancel
						</button>
						<button type="button" className="bridge-btn bridge-btn-primary" onClick={() => void submit()} disabled={loading || !email.trim()}>
							{loading ? 'Sending...' : 'Send Invite'}
						</button>
					</div>
				)}
			</div>
		</dialog>
	);
}

export default InviteDialog;

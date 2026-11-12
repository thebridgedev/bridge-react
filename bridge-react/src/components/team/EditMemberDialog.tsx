/**
 * Changes a member's role, or turns their access off and on. The roles listed
 * are the ones the editor may give. Bridge decides; a refusal shows here.
 */
import type { Member, MemberUpdate, Role } from '@nebulr-group/bridge-auth-core';
import { useEffect, useMemo, useRef, useState, type DialogHTMLAttributes, type ReactNode } from 'react';
import { getBridge } from '../../core/client.js';
import { errorMessage } from '../../core/i18n.js';
import { useTranslator } from '../../react/hooks.js';
import { Alert } from '../shared/Alert.js';
import type { DialogActions } from './ConfirmDialog.js';

export interface EditMemberDialogProps extends Omit<DialogHTMLAttributes<HTMLDialogElement>, 'open' | 'title' | 'onClose'> {
	readonly open?: boolean;
	readonly member?: Member | null;
	readonly onClose?: () => void;
	readonly onUpdated?: (member: Member) => void;
	/** Replaces the title and subtitle. */
	readonly title?: ReactNode;
	/** Replaces the Cancel and Save buttons. */
	readonly actions?: (actions: DialogActions) => ReactNode;
}

// A member whose access is off reads as disabled or suspended.
const isOff = (m: Member) => m.status === 'disabled' || m.status === 'suspended';

export function EditMemberDialog({ open = false, member = null, onClose, onUpdated, title, actions, ...rest }: EditMemberDialogProps) {
	const t = useTranslator();
	const dialog = useRef<HTMLDialogElement>(null);
	const [role, setRole] = useState('');
	const [enabled, setEnabled] = useState(true);
	const [roles, setRoles] = useState<Role[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Keep the member's current role selectable even when the editor may not give it.
	const options = useMemo(() => {
		const list = roles.map((r) => ({ key: r.key, name: r.name }));
		const current = member?.role;
		if (current && !list.some((r) => r.key === current)) list.unshift({ key: current, name: current });
		return list;
	}, [roles, member]);

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
		setRole(member?.role ?? '');
		setEnabled(member ? !isOff(member) : true);
		setRoles([]);
		setError(null);
		void loadRoles();
	}

	async function loadRoles() {
		try {
			setRoles(await getBridge().team.roles.list({ assignable: true }));
		} catch (err) {
			setError(errorMessage(err, t));
		}
	}

	async function submit() {
		if (!member) return;
		const fields: MemberUpdate = {
			...(role && role !== member.role ? { role } : {}),
			...(enabled === isOff(member) ? { enabled } : {}),
		};
		if (Object.keys(fields).length === 0) {
			onClose?.();
			return;
		}
		setLoading(true);
		setError(null);
		try {
			const updated = await getBridge().team.members.update(member.id, fields);
			onUpdated?.(updated);
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
						<h3 className="bridge-team-dialog-title">Edit Member</h3>
						{member && <p className="bridge-team-dialog-subtitle">{member.user.email}</p>}
					</>
				)}

				{error && (
					<div className="bridge-team-dialog-error">
						<Alert variant="error">{error}</Alert>
					</div>
				)}

				<div className="bridge-team-form-group">
					<label htmlFor="bridge-edit-role">Role</label>
					<select id="bridge-edit-role" value={role} onChange={(e) => setRole(e.target.value)} disabled={loading}>
						{options.map((r) => (
							<option key={r.key} value={r.key}>
								{r.name}
							</option>
						))}
					</select>
				</div>

				<div className="bridge-team-form-group">
					<label className="bridge-team-checkbox-label">
						<input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} disabled={loading} />
						<span>Enabled</span>
					</label>
				</div>

				{actions ? (
					actions({ loading, onConfirm: () => void submit(), onCancel: onClose })
				) : (
					<div className="bridge-team-dialog-actions">
						<button type="button" className="bridge-btn bridge-btn-secondary" onClick={() => onClose?.()} disabled={loading}>
							Cancel
						</button>
						<button type="button" className="bridge-btn bridge-btn-primary" onClick={() => void submit()} disabled={loading}>
							{loading ? 'Saving...' : 'Save Changes'}
						</button>
					</div>
				)}
			</div>
		</dialog>
	);
}

export default EditMemberDialog;

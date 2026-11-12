/**
 * A yes-or-no dialog for a team action, such as removing a member. `detail`
 * adds a line under the message (what else goes with it); `error` shows a
 * refusal without closing the dialog.
 */
import { useEffect, useRef, type DialogHTMLAttributes, type ReactNode } from 'react';
import { Alert } from '../shared/Alert.js';

/** What a custom `actions` render function gets. */
export interface DialogActions {
	readonly loading: boolean;
	readonly onConfirm?: () => void;
	readonly onCancel?: () => void;
}

export interface ConfirmDialogProps extends Omit<DialogHTMLAttributes<HTMLDialogElement>, 'open' | 'title' | 'onClose'> {
	readonly open?: boolean;
	/** The title: text for the dialog's heading (with `message` under it), or your own node, which replaces both. */
	readonly title?: ReactNode;
	readonly message?: string;
	readonly detail?: string | null;
	readonly error?: string | null;
	readonly confirmLabel?: string;
	readonly variant?: 'danger' | 'default';
	readonly loading?: boolean;
	readonly onConfirm?: () => void;
	readonly onCancel?: () => void;
	/** Replaces the Cancel and Confirm buttons. */
	readonly actions?: (actions: DialogActions) => ReactNode;
}

export function ConfirmDialog({
	open = false,
	title = 'Confirm',
	message = 'Are you sure?',
	detail = null,
	error = null,
	confirmLabel = 'Confirm',
	variant = 'danger',
	loading = false,
	onConfirm,
	onCancel,
	actions,
	...rest
}: ConfirmDialogProps) {
	const dialog = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const element = dialog.current;
		if (!element || typeof element.showModal !== 'function') return;
		if (open && !element.open) element.showModal();
		else if (!open && element.open) element.close();
	}, [open]);

	return (
		<dialog ref={dialog} data-bridge-team-dialog="" data-variant={variant} onClose={() => onCancel?.()} {...rest}>
			<div className="bridge-team-dialog-content">
				{typeof title !== 'string' ? (
					title
				) : (
					<>
						<h3 className="bridge-team-dialog-title">{title}</h3>
						<p className="bridge-team-dialog-message">{message}</p>
					</>
				)}

				{detail && (
					<p className="bridge-team-dialog-message" data-bridge-team-dialog-detail="">
						{detail}
					</p>
				)}

				{error && (
					<div className="bridge-team-dialog-error">
						<Alert variant="error">{error}</Alert>
					</div>
				)}

				{actions ? (
					actions({ loading, onConfirm, onCancel })
				) : (
					<div className="bridge-team-dialog-actions">
						<button type="button" className="bridge-btn bridge-btn-secondary" onClick={() => onCancel?.()} disabled={loading}>
							Cancel
						</button>
						<button
							type="button"
							className={`bridge-btn ${variant === 'danger' ? 'bridge-btn-danger' : 'bridge-btn-primary'}`}
							onClick={() => onConfirm?.()}
							disabled={loading}
						>
							{loading ? 'Processing...' : confirmLabel}
						</button>
					</div>
				)}
			</div>
		</dialog>
	);
}

export default ConfirmDialog;

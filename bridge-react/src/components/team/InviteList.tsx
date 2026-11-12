/**
 * The workspace's pending invites. Someone who may manage the team (the
 * `teamManage` flag) can send one again (the old link stops working) or
 * revoke it. The list fetches again on Live notices about accounts.
 */
import type { Invite } from '@nebulr-group/bridge-auth-core';
import { useMemo, useState, type HTMLAttributes } from 'react';
import { getBridge } from '../../core/client.js';
import { errorMessage } from '../../core/i18n.js';
import { resource } from '../../core/resources.js';
import { useCanManageTeam, useResource, useTranslator } from '../../react/hooks.js';
import { Alert } from '../shared/Alert.js';
import { Spinner } from '../shared/Spinner.js';

export interface InviteListProps extends HTMLAttributes<HTMLDivElement> {
	readonly onError?: (error: unknown) => void;
}

// Accepted, revoked and expired invites are history, not pending.
const DONE = new Set(['accepted', 'revoked', 'expired']);

function day(iso: string): string {
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

export function InviteList({ onError, ...rest }: InviteListProps) {
	const t = useTranslator();
	const canManage = useCanManageTeam();
	const store = useMemo(() => resource((client) => client.team.invites.list(), ['accounts.']), []);
	const invites = useResource(store);

	const pending = (invites.value ?? []).filter((invite) => !DONE.has(invite.state));
	const loadingList = invites.value === null && invites.error === null;

	const [busyId, setBusyId] = useState<string | null>(null);
	const [failure, setFailure] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	async function act(invite: Invite, run: () => Promise<unknown>, done: string) {
		setBusyId(invite.id);
		setFailure(null);
		setNotice(null);
		try {
			await run();
			setNotice(done);
			await store.refresh();
		} catch (error) {
			setFailure(errorMessage(error, t));
			onError?.(error);
		} finally {
			setBusyId(null);
		}
	}

	function resend(invite: Invite) {
		const fields = invite.role ? { email: invite.email, role: invite.role } : { email: invite.email };
		void act(invite, () => getBridge().team.invites.create(fields), `Invite sent again to ${invite.email}.`);
	}

	function revoke(invite: Invite) {
		void act(invite, () => getBridge().team.invites.revoke(invite.id), `Invite to ${invite.email} revoked.`);
	}

	return (
		<div data-bridge-team-invites="" data-loading={invites.loading} {...rest}>
			<div className="bridge-team-users-header">
				<h3 className="bridge-team-users-title">Pending Invites</h3>
			</div>

			{failure ? (
				<div className="bridge-team-alert">
					<Alert variant="error">{failure}</Alert>
				</div>
			) : invites.error ? (
				<div className="bridge-team-alert">
					<Alert variant="error">{errorMessage(invites.error, t)}</Alert>
				</div>
			) : null}
			{notice && (
				<div className="bridge-team-alert">
					<Alert variant="success">{notice}</Alert>
				</div>
			)}

			{loadingList ? (
				<div className="bridge-team-loading">
					<Spinner size={32} />
					<span>Loading invites...</span>
				</div>
			) : invites.value !== null && pending.length === 0 ? (
				<div className="bridge-team-empty">
					<p>No pending invites.</p>
				</div>
			) : pending.length > 0 ? (
				<div className="bridge-team-table-wrapper">
					<table className="bridge-team-table">
						<thead>
							<tr>
								<th>Email</th>
								<th>Role</th>
								<th>Expires</th>
								{canManage && <th></th>}
							</tr>
						</thead>
						<tbody>
							{pending.map((invite) => (
								<tr key={invite.id} data-invite-id={invite.id} data-state={invite.state} data-loading={busyId === invite.id}>
									<td>
										<span className="bridge-team-user-email">{invite.email}</span>
									</td>
									<td>
										<span className="bridge-team-badge">{invite.role || '—'}</span>
									</td>
									<td>{day(invite.expiresAt)}</td>
									{canManage && (
										<td className="bridge-team-actions-cell">
											<div className="bridge-team-actions" data-bridge-team-actions="">
												<button type="button" className="bridge-btn bridge-btn-secondary" disabled={busyId !== null} onClick={() => resend(invite)}>
													Resend
												</button>
												<button type="button" className="bridge-btn-danger-sm" data-variant="danger" disabled={busyId !== null} onClick={() => revoke(invite)}>
													Revoke
												</button>
											</div>
										</td>
									)}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : null}
		</div>
	);
}

export default InviteList;

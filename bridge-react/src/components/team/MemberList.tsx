/**
 * The workspace's members, with search. Someone who may manage the team (the
 * `teamManage` flag) also gets Add Member and each row's actions: edit, enable
 * or disable, and remove. Bridge decides every change; a refusal shows its
 * message. The list fetches again on Live notices about accounts.
 */
import type { Member } from '@nebulr-group/bridge-auth-core';
import { useEffect, useMemo, useRef, useState, type HTMLAttributes, type MouseEvent } from 'react';
import { getBridge } from '../../core/client.js';
import { errorMessage } from '../../core/i18n.js';
import { resource } from '../../core/resources.js';
import { useCanManageTeam, useResource, useTranslator } from '../../react/hooks.js';
import { Alert } from '../shared/Alert.js';
import { Spinner } from '../shared/Spinner.js';
import { ConfirmDialog } from './ConfirmDialog.js';
import { EditMemberDialog } from './EditMemberDialog.js';
import { InviteDialog } from './InviteDialog.js';

export interface MemberListProps extends HTMLAttributes<HTMLDivElement> {
	readonly onError?: (error: unknown) => void;
}

const PAGE = 100;
const MAX = 500;

const nameOf = (m: Member) => [m.user.firstName, m.user.lastName].filter((part) => part && part.trim() !== '').join(' ') || m.user.email;

// A member whose access is off reads as disabled or suspended.
const isOff = (m: Member) => m.status === 'disabled' || m.status === 'suspended';

function statusLabel(m: Member): string {
	if (isOff(m)) return 'Disabled';
	const words = m.status.replace(/_/g, ' ');
	return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The counts in a deletion preview as one line, or null when it has none. */
function previewLine(preview: unknown): string | null {
	if (preview === null || typeof preview !== 'object') return null;
	const p = preview as Record<string, unknown>;
	const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object';
	const source = [p['affects'], p['counts']].find(isObject) ?? p;
	const parts = Object.entries(source)
		.filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0)
		.map(([key, n]) => `${n.toLocaleString()} ${key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').toLowerCase()}`);
	return parts.length > 0 ? `This also removes ${parts.join(', ')}.` : null;
}

export function MemberList({ onError, ...rest }: MemberListProps) {
	const t = useTranslator();
	const canManage = useCanManageTeam();

	const [search, setSearch] = useState('');
	const [query, setQuery] = useState('');
	const [limit, setLimit] = useState(PAGE);
	// The list reads the latest search and page size each time it fetches.
	const wanted = useRef({ limit: PAGE, query: '' });
	wanted.current = { limit, query };
	const store = useMemo(
		() =>
			resource(
				(client) => client.team.members.list({ limit: wanted.current.limit, search: wanted.current.query || undefined }),
				['accounts.'],
			),
		[],
	);
	const list = useResource(store);

	const members = list.value ?? [];
	const loadingList = list.value === null && list.error === null;
	const hasMore = members.length >= limit && limit < MAX;

	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	useEffect(() => () => clearTimeout(timer.current), []);

	function onSearch(value: string) {
		setSearch(value);
		clearTimeout(timer.current);
		timer.current = setTimeout(() => {
			const next = value.trim();
			wanted.current = { ...wanted.current, query: next };
			setQuery(next);
			void store.refresh();
		}, 250);
	}

	function showMore() {
		const next = Math.min(MAX, limit + PAGE);
		wanted.current = { ...wanted.current, limit: next };
		setLimit(next);
		void store.refresh();
	}

	const [openMenu, setOpenMenu] = useState<string | null>(null);
	const [busyId, setBusyId] = useState<string | null>(null);
	const [failure, setFailure] = useState<string | null>(null);
	const [inviting, setInviting] = useState(false);
	const [editing, setEditing] = useState<Member | null>(null);
	const [removing, setRemoving] = useState<Member | null>(null);
	const [removeDetail, setRemoveDetail] = useState<string | null>(null);
	const [removeError, setRemoveError] = useState<string | null>(null);
	const [removeBusy, setRemoveBusy] = useState(false);
	const removingId = useRef<string | null>(null);

	// A click anywhere else closes the open row menu.
	useEffect(() => {
		const close = () => setOpenMenu(null);
		document.addEventListener('click', close);
		return () => document.removeEventListener('click', close);
	}, []);

	function fail(error: unknown): string {
		onError?.(error);
		return errorMessage(error, t);
	}

	function toggleMenu(event: MouseEvent, id: string) {
		event.stopPropagation();
		event.nativeEvent.stopImmediatePropagation();
		setOpenMenu(openMenu === id ? null : id);
	}

	function openEdit(member: Member) {
		setOpenMenu(null);
		setEditing(member);
	}

	async function setEnabled(member: Member, enabled: boolean) {
		setOpenMenu(null);
		setFailure(null);
		setBusyId(member.id);
		try {
			await getBridge().team.members.update(member.id, { enabled });
			await store.refresh();
		} catch (error) {
			setFailure(fail(error));
		} finally {
			setBusyId(null);
		}
	}

	async function openRemove(member: Member) {
		setOpenMenu(null);
		setRemoving(member);
		removingId.current = member.id;
		setRemoveDetail(null);
		setRemoveError(null);
		try {
			const preview = await getBridge().team.members.deletionPreview(member.id);
			if (removingId.current === member.id) setRemoveDetail(previewLine(preview));
		} catch {
			// The preview is a courtesy: the removal itself reports a refusal.
		}
	}

	function cancelRemove() {
		removingId.current = null;
		setRemoving(null);
	}

	async function confirmRemove() {
		if (removing === null) return;
		const id = removing.id;
		setRemoveBusy(true);
		setRemoveError(null);
		try {
			await getBridge().team.members.remove(id);
			cancelRemove();
			await store.refresh();
		} catch (error) {
			setRemoveError(fail(error));
		} finally {
			setRemoveBusy(false);
		}
	}

	const addButton = (label: string) => (
		<button type="button" className="bridge-btn bridge-btn-primary" onClick={() => setInviting(true)}>
			{label}
		</button>
	);

	return (
		<>
			<div data-bridge-team-users="" data-loading={list.loading} {...rest}>
				<div className="bridge-team-users-header">
					<h3 className="bridge-team-users-title">Team Members</h3>
					{canManage && addButton('Add Member')}
				</div>

				<div className="bridge-team-form-group">
					<input
						type="search"
						className="bridge-input"
						data-bridge-team-search=""
						placeholder="Search members"
						aria-label="Search members"
						value={search}
						onChange={(e) => onSearch(e.target.value)}
					/>
				</div>

				{failure ? (
					<div className="bridge-team-alert">
						<Alert variant="error">{failure}</Alert>
					</div>
				) : list.error ? (
					<div className="bridge-team-alert">
						<Alert variant="error">{errorMessage(list.error, t)}</Alert>
					</div>
				) : null}

				{loadingList ? (
					<div className="bridge-team-loading">
						<Spinner size={32} />
						<span>Loading team members...</span>
					</div>
				) : list.value !== null && members.length === 0 ? (
					<div className="bridge-team-empty">
						{query ? (
							<p>No members match your search.</p>
						) : (
							<>
								<p>No team members yet.</p>
								{canManage && addButton('Add your first team member')}
							</>
						)}
					</div>
				) : members.length > 0 ? (
					<>
						<div className="bridge-team-table-wrapper">
							<table className="bridge-team-table">
								<thead>
									<tr>
										<th>User</th>
										<th>Role</th>
										<th>Status</th>
										{canManage && <th></th>}
									</tr>
								</thead>
								<tbody>
									{members.map((member) => {
										const off = isOff(member);
										return (
											<tr key={member.id} data-member-id={member.id} data-loading={busyId === member.id}>
												<td>
													<div className="bridge-team-user-cell">
														<div className="bridge-team-user-name">{nameOf(member)}</div>
														<div className="bridge-team-user-email">{member.user.email}</div>
													</div>
												</td>
												<td>
													<span className="bridge-team-badge">{member.role || '—'}</span>
												</td>
												<td>
													<span className="bridge-team-status" data-state={off ? 'disabled' : member.status}>
														{statusLabel(member)}
													</span>
												</td>
												{canManage && (
													<td className="bridge-team-actions-cell">
														<div className="bridge-team-actions" data-bridge-team-actions="">
															<button
																type="button"
																className="bridge-team-actions-trigger"
																aria-label="Actions"
																aria-expanded={openMenu === member.id}
																disabled={busyId === member.id}
																onClick={(e) => toggleMenu(e, member.id)}
															>
																<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
																	<circle cx="8" cy="3" r="1.5" />
																	<circle cx="8" cy="8" r="1.5" />
																	<circle cx="8" cy="13" r="1.5" />
																</svg>
															</button>
															{openMenu === member.id && (
																<div className="bridge-team-actions-menu">
																	<button type="button" className="bridge-team-actions-item" onClick={() => openEdit(member)}>
																		Edit
																	</button>
																	<button type="button" className="bridge-team-actions-item" onClick={() => void setEnabled(member, off)}>
																		{off ? 'Enable' : 'Disable'}
																	</button>
																	<button
																		type="button"
																		className="bridge-team-actions-item bridge-team-actions-item--danger"
																		data-variant="danger"
																		onClick={() => void openRemove(member)}
																	>
																		Remove
																	</button>
																</div>
															)}
														</div>
													</td>
												)}
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
						{hasMore && (
							<button type="button" className="bridge-btn bridge-btn-secondary" data-bridge-team-more="" disabled={list.loading} onClick={showMore}>
								Show more
							</button>
						)}
					</>
				) : null}
			</div>

			{canManage && (
				<>
					<InviteDialog open={inviting} onClose={() => setInviting(false)} onInvited={() => void store.refresh()} />

					<EditMemberDialog open={editing !== null} member={editing} onClose={() => setEditing(null)} onUpdated={() => void store.refresh()} />

					<ConfirmDialog
						open={removing !== null}
						title="Remove Member"
						message={`Remove ${removing ? nameOf(removing) : 'this member'} from the workspace? This cannot be undone.`}
						detail={removeDetail}
						error={removeError}
						confirmLabel="Remove"
						variant="danger"
						loading={removeBusy}
						onConfirm={() => void confirmRemove()}
						onCancel={cancelRemove}
					/>
				</>
			)}
		</>
	);
}

export default MemberList;

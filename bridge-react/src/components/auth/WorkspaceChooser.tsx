/**
 * The workspace list, for two moments:
 *
 * - **At sign-in**, when the person belongs to several: pass the step's
 *   `workspaces` and `onChoose`. SignInForm, VerifyEmail and the hand-off page
 *   do this for you.
 * - **To switch** while signed in: pass nothing. It lists the person's
 *   workspaces and moves the session (every tab follows) on a click.
 *
 * Each row renders as a button; `workspaceItem` replaces a row.
 */
import type { WorkspaceChoice } from '@nebulr-group/bridge-auth-core';
import { useState, type HTMLAttributes, type ReactNode } from 'react';
import { getBridge } from '../../core/client.js';
import type { BridgeMessages } from '../../core/config.js';
import { errorMessage } from '../../core/i18n.js';
import { useSession, useTranslator, useWorkspaces } from '../../react/hooks.js';
import { Alert } from '../shared/Alert.js';
import { Spinner } from '../shared/Spinner.js';

export interface WorkspaceRow {
	readonly id: string;
	readonly name: string | null;
	readonly logo: string | null;
	/** A step this SDK cannot do yet, so the row cannot be chosen. */
	readonly needs?: string;
}

export interface WorkspaceChooserProps extends HTMLAttributes<HTMLDivElement> {
	/** The sign-in step's workspaces. Leave out to switch between the person's own. */
	readonly workspaces?: readonly WorkspaceChoice[];
	/** Called with the chosen id at sign-in. Resolve when the step is done. */
	readonly onChoose?: (workspaceId: string) => Promise<void>;
	/** Called after a switch. */
	readonly onSwitch?: (workspaceId: string) => void;
	/** Replaces a row. */
	readonly workspaceItem?: (item: { workspace: WorkspaceRow; isActive: boolean; isLoading: boolean; onSelect: () => void }) => ReactNode;
	readonly messages?: BridgeMessages;
}

const initial = (name: string | null) => (name ?? '?').trim().charAt(0).toUpperCase() || '?';

export function WorkspaceChooser({ workspaces, onChoose, onSwitch, workspaceItem, messages, ...rest }: WorkspaceChooserProps) {
	const t = useTranslator(messages);
	const session = useSession();
	const mine = useWorkspaces();
	const choosing = workspaces !== undefined;
	const rows: readonly WorkspaceRow[] = choosing ? workspaces : (mine.value ?? []).map((w) => ({ id: w.id, name: w.name, logo: w.logo }));
	const loadingList = !choosing && mine.value === null && mine.error === null;
	const currentId = session.status === 'signed-in' && !choosing ? (session.workspace?.id ?? null) : null;

	const [busyId, setBusyId] = useState<string | null>(null);
	const [failure, setFailure] = useState<string | null>(null);

	async function select(row: WorkspaceRow) {
		if (busyId !== null || row.needs !== undefined) return;
		setFailure(null);
		setBusyId(row.id);
		try {
			if (choosing) {
				await onChoose?.(row.id);
			} else {
				if (row.id !== currentId) await getBridge().workspaces.switch(row.id);
				onSwitch?.(row.id);
			}
		} catch (error) {
			setFailure(errorMessage(error, t, choosing ? 'workspace.error.select' : 'workspace.error.switch'));
		} finally {
			setBusyId(null);
		}
	}

	return (
		<div data-bridge-workspace-selector="" data-loading-list={loadingList} {...rest}>
			{failure ? (
				<Alert variant="error">{failure}</Alert>
			) : !choosing && mine.error ? (
				<Alert variant="error">{errorMessage(mine.error, t, 'workspace.error.load')}</Alert>
			) : null}

			{loadingList ? (
				<div data-bridge-workspace-loading="">
					<Spinner size={24} />
				</div>
			) : rows.length === 0 ? (
				<p className="bridge-step-desc" data-bridge-workspace-empty="">
					{t('workspace.empty')}
				</p>
			) : (
				<div data-bridge-workspace-list="">
					{rows.map((row) => {
						const isActive = row.id === currentId;
						const isLoading = busyId === row.id;
						if (workspaceItem) return <WorkspaceItem key={row.id}>{workspaceItem({ workspace: row, isActive, isLoading, onSelect: () => void select(row) })}</WorkspaceItem>;
						return (
							<button
								key={row.id}
								type="button"
								data-bridge-workspace-item=""
								data-workspace-id={row.id}
								data-active={isActive}
								data-loading={isLoading}
								disabled={busyId !== null || row.needs !== undefined}
								title={row.needs !== undefined ? t('login.error.unsupportedStep') : undefined}
								onClick={() => void select(row)}
							>
								<span data-bridge-workspace-avatar="">{row.logo ? <img src={row.logo} alt="" /> : initial(row.name)}</span>
								<span data-bridge-workspace-info="">
									<span data-bridge-workspace-name="">{row.name ?? row.id}</span>
									{isActive && <span data-bridge-workspace-user="">{t('workspace.current')}</span>}
								</span>
								{isLoading && <Spinner size={18} />}
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}

function WorkspaceItem({ children }: { children: ReactNode }) {
	return <>{children}</>;
}

export default WorkspaceChooser;

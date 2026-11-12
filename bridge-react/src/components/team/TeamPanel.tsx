/**
 * The team panel: members, pending invites, workspace settings and the
 * person's own profile, as tabs. The Invites tab shows only for someone who
 * may manage the team (the `teamManage` flag). `tabBar` replaces the tabs.
 */
import { useState, type HTMLAttributes, type ReactNode } from 'react';
import { useCanManageTeam } from '../../react/hooks.js';
import { InviteList } from './InviteList.js';
import { MemberList } from './MemberList.js';
import { ProfileForm } from './ProfileForm.js';
import { WorkspaceForm } from './WorkspaceForm.js';

export type TeamTabId = 'members' | 'invites' | 'workspace' | 'profile';
export interface TeamTab {
	readonly id: TeamTabId;
	readonly label: string;
}

export interface TeamPanelProps extends HTMLAttributes<HTMLDivElement> {
	readonly defaultTab?: TeamTabId;
	readonly showInvitesTab?: boolean;
	readonly showWorkspaceTab?: boolean;
	readonly showProfileTab?: boolean;
	readonly onError?: (error: unknown) => void;
	/** Replaces the tabs. */
	readonly tabBar?: (bar: { tabs: TeamTab[]; activeTab: string; setTab: (id: string) => void }) => ReactNode;
}

export function TeamPanel({
	defaultTab = 'members',
	showInvitesTab = true,
	showWorkspaceTab = true,
	showProfileTab = true,
	onError,
	tabBar,
	...rest
}: TeamPanelProps) {
	const canManage = useCanManageTeam();
	const [chosen, setChosen] = useState<TeamTabId>(defaultTab);

	const tabs = [
		{ id: 'members', label: 'Members' } as TeamTab,
		showInvitesTab && canManage && ({ id: 'invites', label: 'Invites' } as TeamTab),
		showWorkspaceTab && ({ id: 'workspace', label: 'Workspace' } as TeamTab),
		showProfileTab && ({ id: 'profile', label: 'Profile' } as TeamTab),
	].filter((tab): tab is TeamTab => Boolean(tab));

	// A tab that is no longer offered (its flag turned off) falls back to the first.
	const activeTab = tabs.some((tab) => tab.id === chosen) ? chosen : tabs[0].id;

	function setTab(id: string) {
		if (tabs.some((tab) => tab.id === id)) setChosen(id as TeamTabId);
	}

	return (
		<div data-bridge-team-panel="" {...rest}>
			{tabs.length > 1 &&
				(tabBar ? (
					tabBar({ tabs, activeTab, setTab })
				) : (
					<nav className="bridge-team-tabs">
						{tabs.map((tab) => (
							<button key={tab.id} type="button" className="bridge-team-tab" data-active={activeTab === tab.id} onClick={() => setTab(tab.id)}>
								{tab.label}
							</button>
						))}
					</nav>
				))}

			<div className="bridge-team-tab-content">
				{activeTab === 'members' ? (
					<MemberList onError={onError} />
				) : activeTab === 'invites' ? (
					<InviteList onError={onError} />
				) : activeTab === 'workspace' ? (
					<WorkspaceForm onError={onError} />
				) : activeTab === 'profile' ? (
					<ProfileForm onError={onError} />
				) : null}
			</div>
		</div>
	);
}

export default TeamPanel;

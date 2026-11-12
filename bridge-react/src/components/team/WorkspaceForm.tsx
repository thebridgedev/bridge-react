/**
 * The workspace's name and logo. Editable for someone who may manage the team
 * (the `teamManage` flag); read-only for everyone else. Bridge decides the
 * change; a refusal shows its message.
 */
import type { Workspace } from '@nebulr-group/bridge-auth-core';
import { useEffect, useMemo, useState, type HTMLAttributes } from 'react';
import { getBridge } from '../../core/client.js';
import { errorMessage } from '../../core/i18n.js';
import { resource, workspaces } from '../../core/resources.js';
import { useCanManageTeam, useResource, useTranslator } from '../../react/hooks.js';
import { Alert } from '../shared/Alert.js';
import { Spinner } from '../shared/Spinner.js';

export interface WorkspaceFormProps extends HTMLAttributes<HTMLDivElement> {
	readonly onError?: (error: unknown) => void;
}

export function WorkspaceForm({ onError, ...rest }: WorkspaceFormProps) {
	const t = useTranslator();
	const canManage = useCanManageTeam();
	const store = useMemo(() => resource((client) => client.team.workspace.get(), ['accounts.workspace_updated']), []);
	const current = useResource(store);

	const [base, setBase] = useState<Workspace | null>(null);
	const [name, setName] = useState('');
	const [logo, setLogo] = useState('');
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const changed: { name?: string; logo?: string } = {};
	if (base !== null) {
		if (name.trim() !== (base.name ?? '')) changed.name = name.trim();
		if (logo.trim() !== (base.logo ?? '')) changed.logo = logo.trim();
	}
	const dirty = Object.keys(changed).length > 0;

	function adopt(value: Workspace) {
		setBase(value);
		setName(value.name ?? '');
		setLogo(value.logo ?? '');
	}

	// Fresh values from Bridge fill the form, unless the person is mid-edit.
	useEffect(() => {
		if (current.value !== null && !dirty) adopt(current.value);
	}, [current.value]);

	async function save() {
		if (!dirty) return;
		setSaving(true);
		setError(null);
		setSuccess(null);
		try {
			adopt(await getBridge().team.workspace.update(changed));
			setSuccess('Workspace updated successfully.');
			void workspaces.refresh();
		} catch (err) {
			setError(errorMessage(err, t));
			onError?.(err);
		} finally {
			setSaving(false);
		}
	}

	return (
		<div data-bridge-team-workspace="" data-readonly={!canManage} {...rest}>
			<h3 className="bridge-team-section-title">Workspace Settings</h3>

			{base === null ? (
				current.error ? (
					<div className="bridge-team-alert">
						<Alert variant="error">{errorMessage(current.error, t)}</Alert>
					</div>
				) : (
					<div className="bridge-team-loading">
						<Spinner size={32} />
						<span>Loading workspace...</span>
					</div>
				)
			) : (
				<>
					{error && (
						<div className="bridge-team-alert">
							<Alert variant="error">{error}</Alert>
						</div>
					)}
					{success && (
						<div className="bridge-team-alert">
							<Alert variant="success">{success}</Alert>
						</div>
					)}

					{base.logo && (
						<div className="bridge-team-logo">
							<img src={base.logo} alt={`${base.name ?? 'Workspace'} logo`} />
						</div>
					)}

					<form
						className="bridge-team-form"
						onSubmit={(e) => {
							e.preventDefault();
							void save();
						}}
					>
						<div className="bridge-team-form-group">
							<label htmlFor="bridge-workspace-name">Workspace Name</label>
							<input id="bridge-workspace-name" type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={saving || !canManage} />
						</div>

						<div className="bridge-team-form-group">
							<label htmlFor="bridge-workspace-logo">Logo URL</label>
							<input
								id="bridge-workspace-logo"
								type="url"
								className="bridge-input"
								placeholder="https://"
								value={logo}
								onChange={(e) => setLogo(e.target.value)}
								disabled={saving || !canManage}
							/>
						</div>

						{canManage && (
							<div className="bridge-team-form-actions">
								<button type="submit" className="bridge-btn bridge-btn-primary" disabled={saving || !dirty}>
									{saving ? 'Saving...' : 'Save Changes'}
								</button>
							</div>
						)}
					</form>
				</>
			)}
		</div>
	);
}

export default WorkspaceForm;

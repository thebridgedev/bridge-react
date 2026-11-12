/** The signed-in person's own profile: name and phone number. */
import type { Me } from '@nebulr-group/bridge-auth-core';
import { useEffect, useState, type HTMLAttributes } from 'react';
import { getBridge } from '../../core/client.js';
import { errorMessage } from '../../core/i18n.js';
import { me as meStore } from '../../core/resources.js';
import { useMe, useTranslator } from '../../react/hooks.js';
import { Alert } from '../shared/Alert.js';
import { Spinner } from '../shared/Spinner.js';

type Profile = Pick<Me, 'email' | 'firstName' | 'lastName' | 'phoneNumber'>;

export interface ProfileFormProps extends HTMLAttributes<HTMLDivElement> {
	readonly onError?: (error: unknown) => void;
}

export function ProfileForm({ onError, ...rest }: ProfileFormProps) {
	const t = useTranslator();
	const me = useMe();

	const [base, setBase] = useState<Profile | null>(null);
	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const [phoneNumber, setPhoneNumber] = useState('');
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const changed: { firstName?: string; lastName?: string; phoneNumber?: string } = {};
	if (base !== null) {
		if (firstName.trim() !== (base.firstName ?? '')) changed.firstName = firstName.trim();
		if (lastName.trim() !== (base.lastName ?? '')) changed.lastName = lastName.trim();
		if (phoneNumber.trim() !== (base.phoneNumber ?? '')) changed.phoneNumber = phoneNumber.trim();
	}
	const dirty = Object.keys(changed).length > 0;

	function adopt(value: Profile) {
		setBase(value);
		setFirstName(value.firstName ?? '');
		setLastName(value.lastName ?? '');
		setPhoneNumber(value.phoneNumber ?? '');
	}

	// Fresh values from Bridge fill the form, unless the person is mid-edit.
	useEffect(() => {
		if (me.value !== null && !dirty) adopt(me.value);
	}, [me.value]);

	async function save() {
		if (!dirty) return;
		setSaving(true);
		setError(null);
		setSuccess(null);
		try {
			adopt(await getBridge().me.update(changed));
			setSuccess('Profile updated successfully.');
			await meStore.refresh();
		} catch (err) {
			setError(errorMessage(err, t));
			onError?.(err);
		} finally {
			setSaving(false);
		}
	}

	return (
		<div data-bridge-team-profile="" {...rest}>
			<h3 className="bridge-team-section-title">My Profile</h3>

			{base === null ? (
				me.error ? (
					<div className="bridge-team-alert">
						<Alert variant="error">{errorMessage(me.error, t)}</Alert>
					</div>
				) : (
					<div className="bridge-team-loading">
						<Spinner size={32} />
						<span>Loading profile...</span>
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

					<form
						className="bridge-team-form"
						onSubmit={(e) => {
							e.preventDefault();
							void save();
						}}
					>
						<div className="bridge-team-form-group">
							<label htmlFor="bridge-profile-email">Email</label>
							<input id="bridge-profile-email" type="email" value={base.email} disabled readOnly />
						</div>

						<div className="bridge-team-form-row">
							<div className="bridge-team-form-group">
								<label htmlFor="bridge-profile-first-name">First Name</label>
								<input id="bridge-profile-first-name" type="text" autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={saving} />
							</div>

							<div className="bridge-team-form-group">
								<label htmlFor="bridge-profile-last-name">Last Name</label>
								<input id="bridge-profile-last-name" type="text" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={saving} />
							</div>
						</div>

						<div className="bridge-team-form-group">
							<label htmlFor="bridge-profile-phone">Phone Number</label>
							<input id="bridge-profile-phone" type="tel" autoComplete="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} disabled={saving} />
						</div>

						<div className="bridge-team-form-actions">
							<button type="submit" className="bridge-btn bridge-btn-primary" disabled={saving || !dirty}>
								{saving ? 'Saving...' : 'Save Changes'}
							</button>
						</div>
					</form>
				</>
			)}
		</div>
	);
}

export default ProfileForm;

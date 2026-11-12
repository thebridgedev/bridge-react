/** The signed-in person's name, or their email while it has none. */
import type { HTMLAttributes } from 'react';
import { useMe, useUser } from '../../react/hooks.js';

export function ProfileName(props: HTMLAttributes<HTMLSpanElement>) {
	const profile = useMe().value;
	const user = useUser();
	const full = [profile?.firstName, profile?.lastName].filter((part) => part && part.trim() !== '').join(' ');
	const name = full !== '' ? full : (profile?.email ?? user?.email ?? '');
	if (!name) return null;
	return (
		<span data-bridge-profile-name="" {...props}>
			{name}
		</span>
	);
}

export default ProfileName;

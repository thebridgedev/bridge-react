import { FeatureFlag, Link, ProfileName, SignOutButton, useSignedIn, useWorkspace } from '@nebulr-group/bridge-react';

export function Nav() {
	const signedIn = useSignedIn();
	const workspace = useWorkspace();
	return (
		<nav className="nav" data-testid="nav">
			<Link href="/" className="nav-brand">
				Bridge Demo
			</Link>
			<Link href="/tickets" className="nav-link">
				Tickets
			</Link>
			<FeatureFlag flagKey="reports">
				<Link href="/reports" className="nav-link" data-testid="nav-reports">
					Reports
				</Link>
			</FeatureFlag>
			<Link href="/settings/team" className="nav-link">
				Team
			</Link>
			<Link href="/subscription" className="nav-link">
				Subscription
			</Link>
			<span className="nav-spacer" />
			{signedIn ? (
				<>
					<Link href="/auth/workspaces" className="nav-link" data-testid="nav-workspace">
						{workspace?.name ?? 'Workspace'}
					</Link>
					<ProfileName className="nav-email" data-testid="nav-user" />
					<SignOutButton className="nav-button" data-testid="sign-out" />
				</>
			) : (
				<Link href="/auth/sign-in" className="nav-link" data-testid="nav-sign-in">
					Sign in
				</Link>
			)}
		</nav>
	);
}

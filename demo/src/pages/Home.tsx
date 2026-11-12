import { Link, useSignedIn, useUser, useWorkspace } from '@nebulr-group/bridge-react';

export function Home() {
	const signedIn = useSignedIn();
	const user = useUser();
	const workspace = useWorkspace();
	return (
		<>
			<h1>Helpdesk</h1>
			{signedIn ? (
				<p data-testid="home-signed-in">
					Signed in as {user?.email}, in {workspace?.name ?? 'your workspace'}.
				</p>
			) : (
				<p data-testid="home-visitor">
					A small helpdesk on The Bridge. <Link href="/auth/sign-in">Sign in</Link> or <Link href="/auth/sign-up">sign up</Link>.
				</p>
			)}
		</>
	);
}

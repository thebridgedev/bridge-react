// Rung 3: the app owns the page and its words; Bridge's form sits inside.
import { SignInForm } from '@nebulr-group/bridge-react';

export function CustomSignIn() {
	return (
		<section className="custom-sign-in" data-testid="custom-sign-in">
			<h1>Welcome back to Helpdesk</h1>
			<p>Sign in to see your tickets.</p>
			<SignInForm heading={null} />
		</section>
	);
}

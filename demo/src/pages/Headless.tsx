// Rung 4: no Bridge components at all, only the client.
import { errorMessage, getBridge, translator, useSession } from '@nebulr-group/bridge-react';
import { useState, type FormEvent } from 'react';

export function Headless() {
	const session = useSession();
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [message, setMessage] = useState<string | null>(null);

	async function submit(event: FormEvent) {
		event.preventDefault();
		setMessage(null);
		try {
			const step = await getBridge().signIn.start({ email, password });
			if (!step.done) await step.choose(step.workspaces[0].id);
		} catch (error) {
			setMessage(errorMessage(error, translator()));
		}
	}

	return (
		<>
			<h1>Headless sign-in</h1>
			{session.status === 'signed-in' ? (
				<p data-testid="headless-done">Signed in as {session.user.email}.</p>
			) : (
				<>
					<form onSubmit={(event) => void submit(event)} data-testid="headless-form">
						<input type="email" name="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
						<input type="password" name="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
						<button type="submit">Go</button>
					</form>
					{message && (
						<p role="alert" data-testid="headless-error">
							{message}
						</p>
					)}
				</>
			)}
		</>
	);
}

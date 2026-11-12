// Calling the app's own API with the person's token, and what the browser does when the API refuses at a plan limit.
import { bridgeFetch, FeatureFlag, QuotaBanner } from '@nebulr-group/bridge-react';
import { useState } from 'react';

export function Tickets() {
	const [result, setResult] = useState<string | null>(null);

	async function exportTickets() {
		// The API answers 402 at the plan's limit; bridgeFetch opens the upgrade dialog.
		const response = await bridgeFetch('/api/exports', { method: 'POST' });
		setResult(response.ok ? 'Exported.' : `Refused: ${response.status}`);
	}

	return (
		<>
			<h1>Tickets</h1>
			<QuotaBanner metric="tickets" />
			<p>
				<button className="bridge-btn bridge-btn-secondary" data-testid="export" onClick={() => void exportTickets()}>
					Export
				</button>
			</p>
			{result && <p data-testid="ticket-result">{result}</p>}
			<FeatureFlag flagKey="pdf-export" upgrade>
				<button className="bridge-btn bridge-btn-secondary" data-testid="pdf-export">
					Export as PDF
				</button>
			</FeatureFlag>
		</>
	);
}

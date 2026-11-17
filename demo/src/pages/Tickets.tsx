// Calling the app's own API with the person's token, and what the browser does when the API refuses at a plan limit.
import { bridgeFetch, Entitled, FeatureFlag, QuotaBanner, QuotaGate } from '@nebulr-group/bridge-react';
import { useState } from 'react';

export function Tickets() {
	const [result, setResult] = useState<string | null>(null);

	async function createTicket() {
		const response = await bridgeFetch('/api/tickets', { method: 'POST' });
		setResult(response.ok ? 'Ticket created.' : `Refused: ${response.status}`);
	}

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
				<QuotaGate metric="tickets">
					<button className="bridge-btn bridge-btn-primary" data-testid="new-ticket" onClick={() => void createTicket()}>
						New ticket
					</button>
				</QuotaGate>
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
			<Entitled to="reports" fallback={<p data-testid="reports-not-entitled">Reports are not on your plan.</p>}>
				<p data-testid="reports-entitled">Reports are on your plan.</p>
			</Entitled>
		</>
	);
}

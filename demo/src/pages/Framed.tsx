// Rung 2: the app's frame and headings around every Bridge auth page.
import { BridgeAuthRoutes } from '@nebulr-group/bridge-react';

export function Framed() {
	return (
		<BridgeAuthRoutes
			base="/framed"
			frame={(page, form) => (
				<div className="frame" data-testid="frame" data-page={page}>
					<aside className="frame-brand">Helpdesk</aside>
					<div className="frame-form">{form}</div>
				</div>
			)}
			heading={(page) => (
				<h2 className="frame-heading" data-testid="frame-heading">
					{page === 'sign-in' ? 'Back to your desk' : 'Helpdesk'}
				</h2>
			)}
		/>
	);
}


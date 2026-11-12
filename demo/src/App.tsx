import { BillingNotice, BridgeAuthRoutes, BridgeBillingRoutes, BridgeProvider, type BridgeConfig } from '@nebulr-group/bridge-react';
import { Route, Routes, useLocation, useNavigate } from 'react-router';
import { Nav } from './Nav';
import { CustomSignIn } from './pages/CustomSignIn';
import { Framed } from './pages/Framed';
import { Headless } from './pages/Headless';
import { Home } from './pages/Home';
import { Reports } from './pages/Reports';
import { Team } from './pages/Team';
import { Tickets } from './pages/Tickets';

// The issuer comes from VITE_BRIDGE_ISSUER, so the same build runs against a local Bridge or stage.
const config: BridgeConfig = {
	issuer: import.meta.env.VITE_BRIDGE_ISSUER,
	rules: [
		{ match: '/', public: true },
		{ match: '/custom/*', public: true },
		{ match: '/framed/*', public: true },
		{ match: '/headless', public: true },
		// A page only some people see: the flag's rule says who.
		{ match: '/reports', featureFlag: 'reports', redirectTo: '/' },
	],
	// Bridge's own sign-in page turns this on to sign people in for the CLI.
	handoff: { loopback: true, program: 'the Bridge CLI' },
	// VITE_DEMO_STORAGE=memory keeps the session in the page's memory only: nothing in the browser's storage.
	storage: import.meta.env.VITE_DEMO_STORAGE === 'memory' ? 'memory' : 'local',
};

export function App() {
	// The provider navigates through React Router, so the router sees every navigation.
	const location = useLocation();
	const navigate = useNavigate();
	return (
		<BridgeProvider config={config} router={{ location, navigate: (to, options) => void navigate(to, options) }}>
			<Nav />
			<BillingNotice />
			<main>
				<Routes>
					<Route path="/" element={<Home />} />
					<Route path="/auth/*" element={<BridgeAuthRoutes />} />
					<Route path="/custom/sign-in" element={<CustomSignIn />} />
					<Route path="/framed/*" element={<Framed />} />
					<Route path="/headless" element={<Headless />} />
					<Route path="/reports" element={<Reports />} />
					<Route path="/settings/team" element={<Team />} />
					<Route path="/subscription/*" element={<BridgeBillingRoutes />} />
					<Route path="/tickets" element={<Tickets />} />
					<Route path="*" element={<h1>Not found</h1>} />
				</Routes>
			</main>
		</BridgeProvider>
	);
}

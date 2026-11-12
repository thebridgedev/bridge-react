// @vitest-environment jsdom
/**
 * `<BridgeProvider>` end to end against auth-core's fake issuer: the route
 * guard, email links, a sign-in request in the address, and the auth pages
 * from one route.
 */
import { memoryStorage } from '@nebulr-group/bridge-auth-core';
import { createFakeIssuer } from '@nebulr-group/bridge-auth-core/testing';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { StrictMode, useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { resetClient, startClient } from '../core/client.js';
import { resolveConfig, type BridgeConfig } from '../core/config.js';
import type { BridgeRouter } from '../core/router.js';
import { BridgeAuthRoutes } from './auth/BridgeAuthRoutes.js';
import { BridgeProvider } from './BridgeProvider.js';

const PASSWORD = 'correct horse battery';

function setup(extra: Omit<BridgeConfig, 'issuer'> = {}) {
	const fake = createFakeIssuer();
	fake.addPerson({ email: 'alice@acme.test', password: PASSWORD, firstName: 'Alice', workspaces: [{ id: 'ws-acme', name: 'Acme', role: 'OWNER' }] });
	fake.setFlags({ 'bridge-app-active': true, reports: false });
	const config: BridgeConfig = { issuer: fake.issuer, ...extra };
	// The provider reuses the client already made for the same issuer and storage: this one talks to the fake.
	const client = startClient(resolveConfig(config), { fetch: fake.fetch, storage: memoryStorage(), autoRefresh: false, locks: null, tabChannel: null, live: false });
	return { fake, client, config };
}

/** A router kept in React state, with every navigation recorded. */
function harness(config: BridgeConfig, start: string, page: (path: string) => ReactNode) {
	const visits: string[] = [];
	let go: (to: string) => void = () => undefined;
	function App() {
		const [at, setAt] = useState(() => new URL(start, 'http://localhost'));
		go = (to) => setAt(new URL(to, 'http://localhost'));
		const router: BridgeRouter = {
			location: { pathname: at.pathname, search: at.search, hash: at.hash },
			navigate: (to) => {
				visits.push(to);
				setAt(new URL(to, 'http://localhost'));
			},
		};
		return (
			<BridgeProvider config={config} router={router} loading={<p data-testid="loading" />}>
				<p data-testid="path">{`${at.pathname}${at.search}`}</p>
				{page(at.pathname)}
			</BridgeProvider>
		);
	}
	render(
		<StrictMode>
			<App />
		</StrictMode>,
	);
	return { visits, navigate: (to: string) => act(() => go(to)) };
}

const path = () => screen.getByTestId('path').textContent;

afterEach(() => {
	cleanup();
	resetClient();
});

describe('the route guard', () => {
	const rules = [{ match: '/', public: true }, { match: '/reports', featureFlag: 'reports' }];

	it('sends a visitor to sign-in with the page to come back to, and lets them on public pages', async () => {
		const { config } = setup({ rules });
		const { navigate } = harness({ ...config, rules }, '/settings', () => null);
		await waitFor(() => expect(path()).toBe('/auth/sign-in?redirectUri=%2Fsettings'));
		navigate('/');
		await waitFor(() => expect(path()).toBe('/'));
		expect(screen.queryByTestId('loading')).toBeNull();
	});

	it('keeps a page behind its flag, and sends a signed-in person on from sign-in', async () => {
		const { client, config } = setup({ rules });
		await client.ready;
		await client.signIn.start({ email: 'alice@acme.test', password: PASSWORD });
		const { navigate } = harness({ ...config, rules }, '/settings', () => null);
		await waitFor(() => expect(path()).toBe('/settings'));
		navigate('/reports');
		await waitFor(() => expect(path()).toBe('/'));
		navigate('/auth/sign-in?redirectUri=%2Fsettings');
		await waitFor(() => expect(path()).toBe('/settings'));
	});

	it('sends a signed-out person to sign-in when the session ends', async () => {
		const { client, config } = setup({ rules });
		await client.ready;
		await client.signIn.start({ email: 'alice@acme.test', password: PASSWORD });
		harness({ ...config, rules }, '/settings', () => null);
		await waitFor(() => expect(path()).toBe('/settings'));
		await act(() => client.signOut());
		await waitFor(() => expect(path()).toBe('/auth/sign-in?redirectUri=%2Fsettings'));
	});
});

describe('email links and the auth pages', () => {
	it('sends an email link to its page, keeping the token in the fragment', async () => {
		const { config } = setup();
		const { visits } = harness(config, '/auth#bridge=reset-password&token=abc', () => null);
		await waitFor(() => expect(visits).toContain('/auth/set-password#bridge=reset-password&token=abc'));
	});

	it('sends the bare auth base to sign-in', async () => {
		const { config } = setup();
		harness(config, '/auth?lang=sv', () => null);
		await waitFor(() => expect(path()).toBe('/auth/sign-in?lang=sv'));
	});

	it('serves each page from one route, and nothing for an unknown one', async () => {
		const { config } = setup();
		const { navigate } = harness(config, '/auth/sign-in', () => <BridgeAuthRoutes notFound={<p data-testid="not-found" />} />);
		await waitFor(() => expect(document.querySelector('[data-bridge-auth-route="sign-in"] #login-email')).not.toBeNull());
		navigate('/auth/forgot-password');
		await waitFor(() => expect(document.querySelector('[data-bridge-forgot-password="form"]')).not.toBeNull());
		navigate('/auth/nope');
		await waitFor(() => expect(screen.getByTestId('not-found')).not.toBeNull());
	});
});

describe('a sign-in request in the address', () => {
	const REQUEST = 'r'.repeat(43);

	it('is taken once, and the same page is loaded without it', async () => {
		const { client, config } = setup({ handoff: { requests: true } });
		harness({ ...config, handoff: { requests: true } }, `/auth/sign-in?request=${REQUEST}&lang=sv`, () => null);
		await waitFor(() => expect(path()).toBe('/auth/sign-in?lang=sv'));
		expect(await client.request.current()).toBe(REQUEST);
	});

	it('is left alone on a page that does not sign in for requests', async () => {
		const { client, config } = setup();
		harness(config, `/auth/sign-in?request=${REQUEST}`, () => null);
		await waitFor(() => expect(screen.queryByTestId('loading')).toBeNull());
		expect(path()).toBe(`/auth/sign-in?request=${REQUEST}`);
		expect(await client.request.current()).toBeNull();
	});
});

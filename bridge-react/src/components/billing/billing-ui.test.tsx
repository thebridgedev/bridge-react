// @vitest-environment jsdom
/**
 * Plan limits and plan features, end to end against auth-core's fake issuer: `useQuota`, `useEntitlements`,
 * `QuotaGate`, `Entitled`, `QuotaBanner`, the lock and the 402s.
 */
import { memoryStorage } from '@nebulr-group/bridge-auth-core';
import { createFakeIssuer } from '@nebulr-group/bridge-auth-core/testing';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { resetClient, startClient } from '../../core/client.js';
import { resolveConfig } from '../../core/config.js';
import { bridgeFetch } from '../../core/fetch.js';
import { warningOf } from '../../core/quota.js';
import { closeUpgrade, onBridgeQuotaExceeded, parseQuotaRefusal, upgradeRequest, type BridgeQuotaRefusal } from '../../core/upgrade.js';
import { useBillingGate } from '../../react/billing-gate.js';
import { useEntitlements } from '../../react/entitlements.js';
import { useQuota } from '../../react/quota.js';
import { BillingNotice } from './BillingNotice.js';
import { Entitled } from './Entitled.js';
import { QuotaBanner } from './QuotaBanner.js';
import { QuotaGate, quotaGateState } from './QuotaGate.js';
import { quotaBannerCopy, quotaBannerState } from './quota-copy.js';

const PASSWORD = 'correct horse battery';
const API = 'https://api.example.test';
const read = (used: number, limit: number, extra: object = {}) => ({ used, limit, remaining: Math.max(0, limit - used), policy: 'hard', ...extra });

async function signedIn(options: { flags?: Record<string, boolean>; facts?: Record<string, unknown>; api?: (url: string) => Response } = {}) {
	const fake = createFakeIssuer();
	fake.addPerson({ email: 'alice@acme.test', password: PASSWORD, workspaces: [{ id: 'ws-acme', name: 'Acme', role: 'OWNER' }] });
	fake.setFlags({ 'bridge-app-active': true, 'bridge-billing-manage': true, ...options.flags });
	fake.setFacts({ plan: { key: 'free', name: 'Free' }, status: 'active', access: 'ok', ...options.facts });
	const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = new Request(input, init).url;
		return options.api !== undefined && url.startsWith(API) ? options.api(url) : fake.fetch(input, init);
	}) as typeof fetch;
	const client = startClient(resolveConfig({ issuer: fake.issuer, tokenOrigins: [API] }), {
		fetch: fetchFn,
		storage: memoryStorage(),
		autoRefresh: false,
		locks: null,
		tabChannel: null,
		live: false,
	});
	await client.signIn.start({ email: 'alice@acme.test', password: PASSWORD });
	await client.flags.load();
	return { fake, client };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

afterEach(() => {
	cleanup();
	resetClient();
	closeUpgrade();
});

describe('useQuota', () => {
	it('is loading, then the numbers, and moves when the quota is read again', async () => {
		const { fake, client } = await signedIn();
		fake.setQuota('tickets', read(8, 10));
		const { result } = renderHook(() => useQuota('tickets'));
		expect(result.current).toMatchObject({ loading: true, used: null, limit: null });
		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current).toMatchObject({ unlimited: false, used: 8, limit: 10, remaining: 2, kind: 'counter', warningLevel: 'approaching', ratio: 0.8, state: 'near' });
		expect(result.current.snapshot?.policy).toBe('hard');
		fake.setQuota('tickets', read(10, 10, { kind: 'gauge' }));
		await act(() => client.quotas.refresh());
		expect(result.current).toMatchObject({ used: 10, kind: 'gauge', ratio: 1, state: 'over' });
	});

	it('says unlimited for a metric the plan sets no limit on, and asks once', async () => {
		const { fake } = await signedIn();
		fake.setQuota('seats', null);
		const { result, rerender } = renderHook(() => useQuota('seats'));
		expect(result.current.loading).toBe(true);
		await waitFor(() => expect(result.current).toMatchObject({ loading: false, unlimited: true, used: null, limit: null, ratio: null, state: null }));
		rerender();
		renderHook(() => useQuota('seats'));
		await flush();
		expect(fake.quotaReads.filter((m) => m === 'seats')).toHaveLength(1);
	});

	it('asks again once a person has signed in again, whatever it was before', async () => {
		const { fake, client } = await signedIn();
		fake.setQuota('seats', null);
		const { result } = renderHook(() => useQuota('seats'));
		await waitFor(() => expect(result.current.unlimited).toBe(true));
		await act(() => client.signOut());
		fake.setQuota('seats', read(2, 5));
		await act(() => client.signIn.start({ email: 'alice@acme.test', password: PASSWORD }));
		await waitFor(() => expect(result.current).toMatchObject({ unlimited: false, used: 2, limit: 5 }));
	});

	it('is loading before there is a client, never a zero', () => {
		const { result } = renderHook(() => useQuota('tickets'));
		expect(result.current).toMatchObject({ loading: true, unlimited: false, used: null, limit: null });
	});
});

describe('useEntitlements', () => {
	it('reads the entitlement flags, fail-closed, and says when it is ready', async () => {
		const before = renderHook(() => useEntitlements());
		expect(before.result.current).toMatchObject({ ready: false, all: {} });
		expect(before.result.current.can('analytics')).toBe(false);
		before.unmount();
		await signedIn({ flags: { 'bridge:billing.entitlement.analytics': true, 'bridge:billing.entitlement.sso': false, analytics: true } });
		const { result } = renderHook(() => useEntitlements());
		expect(result.current.ready).toBe(true);
		expect(result.current.can('analytics')).toBe(true);
		expect(result.current.can('sso')).toBe(false);
		expect(result.current.can('unknown')).toBe(false);
		expect(result.current.all).toEqual({ analytics: true, sso: false });
	});

	it('follows a plan change', async () => {
		const { fake, client } = await signedIn({ flags: { 'bridge:billing.entitlement.sso': false } });
		const { result } = renderHook(() => useEntitlements());
		expect(result.current.can('sso')).toBe(false);
		fake.setFlags({ 'bridge-app-active': true, 'bridge:billing.entitlement.sso': true });
		await act(() => client.flags.load());
		expect(result.current.can('sso')).toBe(true);
	});
});

describe('QuotaGate', () => {
	// A button in a disabled fieldset is disabled by the browser: it matches `:disabled`, though its own property stays false.
	const button = () => screen.getByRole('button', { name: 'New ticket' });
	const gate = () => document.querySelector('[data-bridge-quota-gate]');

	it('disables its children at a hard limit and offers the upgrade', async () => {
		const { fake, client } = await signedIn();
		fake.setQuota('tickets', read(3, 3));
		await client.quotas.read('tickets');
		const { unmount } = render(
			<QuotaGate metric="tickets">
				<button>New ticket</button>
			</QuotaGate>,
		);
		expect(button().matches(':disabled')).toBe(true);
		expect(gate()?.getAttribute('data-state')).toBe('at-limit');
		expect(document.querySelector('[data-bridge-quota-gate-limit]')?.textContent).toContain('all 3 tickets on your plan.');
		expect(document.querySelector('[data-bridge-quota-gate-limit] a')?.getAttribute('href')).toBe('/subscription');
		unmount();
		render(
			<QuotaGate metric="tickets" atLimit={(q) => <>{q.used} of {q.limit} used</>}>
				<button>New ticket</button>
			</QuotaGate>,
		);
		expect(document.querySelector('[data-bridge-quota-gate-limit]')?.textContent).toBe('3 of 3 used');
	});

	it('never disables on "do not know yet", no limit, a metered limit, or room left', async () => {
		const { fake, client } = await signedIn();
		fake.setQuota('tickets', read(1, 3));
		fake.setQuota('seats', null);
		fake.setQuota('exports', read(9, 5, { policy: 'metered' }));
		const states: Record<string, string | null | undefined> = {};
		for (const metric of ['tickets', 'seats', 'exports']) {
			const { unmount } = render(
				<QuotaGate metric={metric}>
					<button>New ticket</button>
				</QuotaGate>,
			);
			expect(button().matches(':disabled')).toBe(false);
			if (metric === 'tickets') expect(gate()?.getAttribute('data-state')).toBe('loading');
			unmount();
		}
		await Promise.all(['tickets', 'seats', 'exports'].map((m) => client.quotas.read(m)));
		for (const metric of ['tickets', 'seats', 'exports']) {
			const { unmount } = render(
				<QuotaGate metric={metric}>
					<button>New ticket</button>
				</QuotaGate>,
			);
			await waitFor(() => expect(gate()?.getAttribute('data-state')).not.toBe('loading'));
			states[metric] = gate()?.getAttribute('data-state');
			expect(button().matches(':disabled')).toBe(false);
			unmount();
		}
		expect(states).toEqual({ tickets: 'available', seats: 'unlimited', exports: 'metered' });
	});

	it('decides from the quota alone', () => {
		const loaded = { loading: false, unlimited: false, used: 3, limit: 3, remaining: 0, warningLevel: null, kind: 'counter', snapshot: null, ratio: 1, state: 'over' } as const;
		expect(quotaGateState(loaded)).toBe('at-limit');
		expect(quotaGateState({ ...loaded, remaining: 1, used: 2, ratio: 0.6, state: 'ok' })).toBe('available');
	});
});

describe('Entitled', () => {
	it('renders neither branch until Bridge has answered, then the one that applies', async () => {
		const wait = render(
			<Entitled to="analytics" fallback={<p>no</p>} loading={<p>wait</p>}>
				<p>yes</p>
			</Entitled>,
		);
		expect(screen.queryByText('wait')).not.toBeNull();
		wait.unmount();
		await signedIn({ flags: { 'bridge:billing.entitlement.analytics': true } });
		const on = render(
			<Entitled to="analytics" fallback={<p>no</p>}>
				<p>yes</p>
			</Entitled>,
		);
		expect(screen.queryByText('yes')).not.toBeNull();
		expect(screen.queryByText('no')).toBeNull();
		on.unmount();
		render(
			<Entitled to="sso" fallback={<p>no</p>}>
				<p>yes</p>
			</Entitled>,
		);
		expect(screen.queryByText('no')).not.toBeNull();
		expect(screen.queryByText('yes')).toBeNull();
	});
});

describe('QuotaBanner', () => {
	const banner = () => document.querySelector('[data-bridge-quota-banner]');

	it('shows from 80%, the limit reached, and the overage of a metered limit; nothing below', async () => {
		const { fake, client } = await signedIn();
		fake.setQuota('low', read(1, 10));
		fake.setQuota('near', read(8, 10));
		fake.setQuota('edge', read(10, 10));
		fake.setQuota('over', read(12, 10));
		fake.setQuota('metered', read(12, 10, { policy: 'metered', overageEstimate: 2, currency: 'usd' }));
		await Promise.all(['low', 'near', 'edge', 'over', 'metered'].map((m) => client.quotas.read(m)));
		const shows = async (metric: string, label?: string) => {
			const { unmount } = render(<QuotaBanner metric={metric} label={label} />);
			await flush();
			const found = banner();
			const state = found?.getAttribute('data-state') ?? null;
			const text = found?.textContent ?? '';
			const cta = found?.querySelector('[data-bridge-quota-banner-cta]')?.textContent ?? null;
			unmount();
			return { state, text, cta };
		};
		expect((await shows('low')).state).toBeNull();
		expect((await shows('unasked')).state).toBeNull();
		const near = await shows('near', 'Tickets');
		expect(near).toMatchObject({ state: 'approaching', cta: 'Upgrade' });
		expect(near.text).toContain('Tickets approaching cap');
		expect((await shows('edge')).state).toBe('reached');
		expect((await shows('over')).state).toBe('over');
		const metered = await shows('metered');
		expect(metered.state).toBe('metered');
		expect(metered.text).toContain('2 over your 10 included');
	});

	it('moves by itself when the quota is read again, and is the 0.9 name too', async () => {
		const { fake, client } = await signedIn();
		fake.setQuota('tickets', read(1, 10));
		render(<QuotaBanner metric="tickets" />);
		await flush();
		expect(banner()).toBeNull();
		fake.setQuota('tickets', read(10, 10));
		await act(() => client.quotas.refresh());
		expect(banner()?.getAttribute('data-state')).toBe('reached');
		expect(banner()?.getAttribute('role')).toBe('alert');
		const { BridgeQuotaBanner, QuotaBanner: Same } = await import('../../index.js');
		expect(BridgeQuotaBanner).toBe(Same);
	});

	it('tells a person who may not manage billing to ask the owner, without an upgrade link', async () => {
		const { fake, client } = await signedIn({ flags: { 'bridge-billing-manage': false } });
		fake.setQuota('edge', read(10, 10));
		await client.quotas.read('edge');
		render(<QuotaBanner metric="edge" />);
		await waitFor(() => expect(banner()).not.toBeNull());
		expect(banner()?.textContent).toContain('Contact your workspace owner.');
		expect(banner()?.querySelector('[data-bridge-quota-banner-cta]')).toBeNull();
	});

	it('decides from the numbers when the server sent no warning level', () => {
		const snap = (used: number) => ({ metric: 'm', used, limit: 100, remaining: 100 - used, percent_used: used / 100, policy: 'hard' as const, warningLevel: null, label: 'm' });
		expect(quotaBannerState(snap(79))).toBe('hidden');
		expect(quotaBannerState(snap(80))).toBe('approaching');
		expect(quotaBannerState(snap(95))).toBe('critical');
		expect(quotaBannerState(snap(100))).toBe('reached');
		expect(quotaBannerState(snap(101))).toBe('over');
		expect(warningOf(snap(96))).toBe('critical');
		expect(quotaBannerCopy(snap(96), false, 'Seats').body).toBe('Your workspace is approaching its Seats cap. Contact your workspace owner.');
		expect(quotaBannerState(undefined)).toBe('hidden');
	});
});

describe('the billing lock', () => {
	const locked = { status: 'past_due', access: 'blocked', locked: true };

	it('shows to the person, as a banner or a blocking screen', async () => {
		await signedIn({ facts: locked });
		const gate = renderHook(() => useBillingGate());
		await waitFor(() => expect(gate.result.current).toMatchObject({ locked: true, severity: 'locked' }));
		const soft = render(<BillingNotice />);
		expect(document.querySelector('[data-bridge-billing-notice][data-kind="blocked"]')?.textContent).toContain('Access locked');
		expect(document.querySelector('[data-bridge-billing-lockscreen]')).toBeNull();
		soft.unmount();
		render(<BillingNotice mode="hard" />);
		expect(document.querySelector('[data-bridge-billing-lockscreen]')?.getAttribute('role')).toBe('alertdialog');
	});

	it('shows at once when your API refuses a write because of the lock, and opens no dialog', async () => {
		const { client } = await signedIn({
			api: () => Response.json({ code: 'BILLING_GATE_ENGAGED', reason: 'billing_locked', billing: { status: 'past_due', gateEngaged: true } }, { status: 402 }),
		});
		await flush();
		const gate = renderHook(() => useBillingGate());
		expect(gate.result.current.locked).toBe(false);
		render(<BillingNotice mode="hard" />);
		expect(document.querySelector('[data-bridge-billing-lockscreen]')).toBeNull();
		const response = await act(() => bridgeFetch(`${API}/tickets`, { method: 'POST' }));
		expect(response.status).toBe(402);
		expect(client.isLocked()).toBe(true);
		await waitFor(() => expect(gate.result.current).toMatchObject({ locked: true, recoveryUrl: '/subscription' }));
		expect(upgradeRequest.get()).toBeNull();
		await waitFor(() => expect(document.querySelector('[data-bridge-billing-lockscreen]')).not.toBeNull());
	});
});

describe('a 402 at a plan limit', () => {
	const limit = { statusCode: 402, code: 'QUOTA_EXCEEDED', message: 'Over', metric: 'tickets', used: 3, limit: 3, fix: '/subscription' };

	it('opens the upgrade dialog and tells the listeners, who can stop listening', async () => {
		await signedIn({ api: () => Response.json(limit, { status: 402 }) });
		const heard: BridgeQuotaRefusal[] = [];
		const stop = onBridgeQuotaExceeded((refusal) => heard.push(refusal));
		onBridgeQuotaExceeded(() => {
			throw new Error('a broken listener');
		});
		await bridgeFetch(`${API}/tickets`, { method: 'POST' });
		expect(upgradeRequest.get()).toMatchObject({ kind: 'limit', metric: 'tickets', used: 3, limit: 3, upgradeHref: '/subscription' });
		expect(heard).toEqual([{ metric: 'tickets', used: 3, limit: 3, fix: '/subscription', message: 'Over', url: `${API}/tickets` }]);
		stop();
		await bridgeFetch(`${API}/tickets`, { method: 'POST' });
		expect(heard).toHaveLength(1);
	});

	it('is not a refusal when it is a missing plan feature, a declined card or not a 402 body', () => {
		expect(parseQuotaRefusal({ code: 'FEATURE_NOT_IN_PLAN', flag: 'reports' })).toBeNull();
		expect(parseQuotaRefusal({ code: 'CARD_DECLINED' })).toBeNull();
		expect(parseQuotaRefusal('nope')).toBeNull();
		expect(parseQuotaRefusal({ type: 'urn:bridge:problem:limit-reached', metric: 'seats', limit: 5, used: 5 })).toMatchObject({ metric: 'seats', fix: null });
	});
});

describe('the 0.9 names', () => {
	it('BridgeBillingNotice, BridgeQuotaBanner and BridgeUpgradeDialog are the 1.0 components', async () => {
		const lib = await import('../../index.js');
		expect(lib.BridgeBillingNotice).toBe(lib.BillingNotice);
		expect(lib.BridgeQuotaBanner).toBe(lib.QuotaBanner);
		expect(lib.BridgeUpgradeDialog).toBe(lib.UpgradeDialog);
	});

	it('dismissQuotaRefusal closes the upgrade dialog a refusal opened', async () => {
		const { dismissQuotaRefusal } = await import('../../index.js');
		await signedIn({ api: () => new Response(JSON.stringify({ statusCode: 402, code: 'QUOTA_EXCEEDED', metric: 'tickets', used: 3, limit: 3, fix: '/subscription', message: 'Over' }), { status: 402, headers: { 'content-type': 'application/json' } }) });
		await bridgeFetch(`${API}/tickets`, { method: 'POST' });
		expect(upgradeRequest.get()).not.toBeNull();
		dismissQuotaRefusal();
		expect(upgradeRequest.get()).toBeNull();
	});

	it('useBridgeBilling answers before there is a client: nothing locked, no quota, no feature', async () => {
		const { useBridgeBilling } = await import('../../index.js');
		const billing = useBridgeBilling();
		expect(billing.isLocked()).toBe(false);
		expect(billing.gateState()).toEqual({ locked: false, severity: 'info', noticeState: 'active' });
		expect(billing.quota('tickets')).toBeUndefined();
		expect(billing.entitlements.can('analytics')).toBe(false);
		expect(billing.entitlements.all()).toEqual({});
		expect(() => billing.assertNotLocked()).not.toThrow();
		expect(() => billing.quotas).toThrow();
	});

	it('useBridgeBilling follows the page\'s client: quota, plan features, the lock and the quota.updated handler', async () => {
		const { useBridgeBilling } = await import('../../index.js');
		const billing = useBridgeBilling();
		const heard: string[] = [];
		const stop = billing.handle({ 'quota.updated': (message) => heard.push(message.metric) });
		const { fake } = await signedIn({ flags: { 'bridge:billing.entitlement.analytics': true }, facts: { status: 'past_due', access: 'blocked' } });
		fake.setQuota('tickets', read(2, 5));
		expect(billing.quota('tickets')).toBeUndefined();
		await waitFor(() => expect(billing.quota('tickets')).toMatchObject({ used: 2, limit: 5 }));
		expect(billing.quotas.get('tickets')).toMatchObject({ used: 2 });
		expect(billing.entitlements.can('analytics')).toBe(true);
		expect(billing.entitlements.all()).toMatchObject({ analytics: true });
		await waitFor(() => expect(billing.isLocked()).toBe(true));
		expect(billing.gateState()).toMatchObject({ locked: true, severity: 'locked' });
		expect(() => billing.assertNotLocked()).toThrow();
		stop();
		expect(heard).toEqual([]);
	});
});

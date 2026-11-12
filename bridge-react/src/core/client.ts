/**
 * The page's Bridge client. `<BridgeProvider>` makes one per page, in the
 * browser, and every hook and component reads it from here. Code outside
 * React (`bridgeFetch`, your own modules) reads the same one with
 * `getBridge()`.
 */
import { createBridge, localStorageAdapter, memoryStorage, type Bridge, type BridgeOptions, type SignedOutReason } from '@nebulr-group/bridge-auth-core';
import type { ResolvedConfig } from './config.js';
import { setAppCopy } from './i18n.js';
import { Value, type Watchable } from './value.js';

const clientValue = new Value<Bridge | null>(null);
const configValue = new Value<ResolvedConfig | null>(null);

/** The client, once `<BridgeProvider>` has made it; null before. */
export const bridgeClient: Watchable<Bridge | null> = clientValue;
/** The resolved settings, once `<BridgeProvider>` has run; null before. */
export const bridgeConfig: Watchable<ResolvedConfig | null> = configValue;

/** Why the last session ended, for the sign-in page to say so once. */
let lastEnded: SignedOutReason | null = null;

/**
 * The page's Bridge client, for anything the components do not cover:
 * `getBridge().me.get()`, `getBridge().fetch(...)`. Throws before
 * `<BridgeProvider>` has made it.
 */
export function getBridge(): Bridge {
	const client = clientValue.get();
	if (client === null) {
		throw new Error('[bridge] No Bridge client yet. Wrap your app in <BridgeProvider config={{ issuer }}>.');
	}
	return client;
}

/** The resolved settings. Throws before `<BridgeProvider>` has run. */
export function getConfig(): ResolvedConfig {
	const config = configValue.get();
	if (config === null) throw new Error('[bridge] <BridgeProvider> has not run yet.');
	return config;
}

/** The settings, or null before `<BridgeProvider>`: for components that render before it. */
export function peekConfig(): ResolvedConfig | null {
	return configValue.get();
}

/** Takes the reason the last session ended, once. */
export function takeEndedReason(): SignedOutReason | null {
	const reason = lastEnded;
	lastEnded = null;
	return reason;
}

/**
 * Makes the page's client, or returns the one already made for the same
 * issuer and storage. A new issuer or storage replaces it. Safe to call on
 * every render: React's strict mode and remounts get the same client.
 */
export function startClient(config: ResolvedConfig, extra?: Partial<BridgeOptions>): Bridge {
	const current = clientValue.get();
	const previous = configValue.get();
	setAppCopy(config.locale, config.messages);
	configValue.set(config);
	if (current !== null && previous?.issuer === config.issuer && previous.storage === config.storage) return current;
	current?.destroy();
	const client = createBridge({
		issuer: config.issuer,
		tokenOrigins: config.tokenOrigins,
		...(config.live ? {} : { live: false as const }),
		// Memory: the refresh token and the visitor id stay in this page. A sign-up's verifier waits in localStorage
		// for its email link, which opens in a new tab, for the link's 15 minutes at most, and is removed once used.
		...(config.storage === 'memory' ? { storage: memoryStorage(), signUpStorage: localStorageAdapter() } : {}),
		...(config.linkAddress === undefined ? {} : { linkAddress: config.linkAddress }),
		...extra,
	});
	// A page that signs in for other apps' sign-in requests takes the request from its address, before any form.
	const request = config.signInRequests && typeof location !== 'undefined' ? new URLSearchParams(location.search).get('request') : null;
	if (request !== null) {
		void client.request.use(request).catch(() => undefined);
		dropRequestFromAddress();
	}
	client.on('signed-out', ({ reason }) => {
		if (reason === 'session-ended' || reason === 'access-removed') lastEnded = reason;
	});
	const hints = config.hints;
	if (hints !== undefined) {
		// Flag results are fetched once the client starts; the hints follow as soon as it has.
		client.on('ready', () => void client.flags.setHints(hints).catch(() => undefined));
	}
	clientValue.set(client);
	return client;
}

/**
 * Removes `request` from the address bar and the history entry once read:
 * while the request is unspent, anyone who reads it there could sign in on
 * it as themselves and plant the result in this browser.
 */
export function dropRequestFromAddress(): void {
	if (typeof window === 'undefined') return;
	const url = new URL(window.location.href);
	if (!url.searchParams.has('request')) return;
	url.searchParams.delete('request');
	window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

/** For tests: forget the client. */
export function resetClient(): void {
	clientValue.get()?.destroy();
	clientValue.set(null);
	configValue.set(null);
	lastEnded = null;
}

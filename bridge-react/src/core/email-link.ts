/**
 * Email links land with their token in the fragment
 * (`#bridge=verify-email&token=…`), which never reaches a server log or a
 * Referer header. A page takes the token once and clears the fragment, so
 * the token does not stay in the address bar or the history.
 */
import { readEmailLink, type EmailLink } from '@nebulr-group/bridge-auth-core';

export function takeEmailLink(kind: EmailLink['kind']): string | null {
	if (typeof window === 'undefined') return null;
	const link = readEmailLink(window.location.hash);
	if (link === null || link.kind !== kind) return null;
	// The router's own history state is kept, so a router that keeps state there is not confused.
	window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
	window.dispatchEvent(new HashChangeEvent('hashchange'));
	return link.token;
}

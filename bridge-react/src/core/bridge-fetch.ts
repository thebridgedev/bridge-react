/**
 * TBP-743 — level 0 of the plan-limit UI, and `bridgeFetch()`.
 *
 * Port of bridge-svelte's `core/bridge-fetch.ts` (TBP-697 / TBP-703), for a
 * plugin that owns no GraphQL client. Two pieces:
 *
 *   - `installQuotaObserver()` — `<BridgeProvider>` wraps `globalThis.fetch`
 *     so a `402 QUOTA_EXCEEDED` (or `402 FEATURE_NOT_IN_PLAN`) from the page's
 *     own origin, Bridge's API or a `billing.apiOrigins` entry opens the
 *     upgrade dialog with no code on the page. It only LOOKS: requests and
 *     responses pass through unchanged and undelayed (the body is read from a
 *     clone, after the fact), and no header is added to any request.
 *   - `bridgeFetch(url, init)` — `fetch` for calls to your own backend that
 *     carry the signed-in user's access token.
 */
import { getBridgeAuth, getBridgeConfig } from './bridge-instance';
import { observeQuotaRefusal, watchesQuotaOrigin } from './quota-refusal';
import { noteBackendResponse } from './double-count-warning';
import { PRODUCTION_API_BASE_URL } from './resolve-config';

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (typeof URL !== 'undefined' && input instanceof URL) return input.href;
  return (input as Request).url;
}

function pageHref(): string | undefined {
  const href = (globalThis as { location?: { href?: unknown } }).location?.href;
  return typeof href === 'string' ? href : undefined;
}

/** `url` made absolute against the page, so a relative `/api/x` has an origin. */
function absoluteUrl(url: string): string {
  try {
    return new URL(url, pageHref()).href;
  } catch {
    return url;
  }
}

/** Hand a 402 from a watched origin to the upgrade-dialog check. */
function observeIfWatched(response: Response, url: string): void {
  if (!response || response.status !== 402) return;
  const config = getBridgeConfig();
  const href = pageHref();
  let pageOrigin: string | undefined;
  try {
    pageOrigin = href ? new URL(href).origin : undefined;
  } catch {
    pageOrigin = undefined;
  }
  const watched = watchesQuotaOrigin(url, {
    pageOrigin,
    apiBaseUrl: config?.apiBaseUrl ?? PRODUCTION_API_BASE_URL,
    apiOrigins: config?.billing?.apiOrigins,
  });
  if (watched) void observeQuotaRefusal(response, absoluteUrl(url));
}

let _originalFetch: typeof fetch | null = null;
let _installedFetch: typeof fetch | null = null;

/**
 * Wrap `globalThis.fetch` so a plan-limit refusal from a watched origin opens
 * the upgrade dialog. Idempotent. Returns nothing; `uninstallQuotaObserver()`
 * restores the original.
 */
export function installQuotaObserver(): void {
  if (typeof globalThis === 'undefined' || typeof globalThis.fetch !== 'function') return;
  // Already in place. (If something replaced `fetch` since — a test double, a
  // later polyfill — wrap the new one instead of assuming ours still runs.)
  if (_installedFetch && globalThis.fetch === _installedFetch) return;
  const base = globalThis.fetch;
  _originalFetch = base;
  const wrapped = async function bridgeObservedFetch(input: RequestInfo | URL, init?: RequestInit) {
    const response = await base(input, init);
    try {
      const url = requestUrl(input);
      observeIfWatched(response, url);
      noteBackendResponse(response); // dev-only double-count check
    } catch {
      /* observing must never break the caller's request */
    }
    return response;
  } as typeof fetch;
  _installedFetch = wrapped;
  globalThis.fetch = wrapped;
}

/**
 * Restore the `fetch` that was there before `installQuotaObserver()`. When
 * something else wrapped `fetch` on top of ours since, it is left alone (its
 * wrapper still calls ours, which keeps working).
 */
export function uninstallQuotaObserver(): void {
  if (!_originalFetch) return;
  if (globalThis.fetch === _installedFetch) globalThis.fetch = _originalFetch;
  _originalFetch = null;
  _installedFetch = null;
}

/**
 * `bridgeFetch(url, init)`: `fetch` for calls to **your own backend** that
 * carry the signed-in user's Bridge access token.
 *
 *   import { bridgeFetch } from '@nebulr-group/bridge-react';
 *   const res = await bridgeFetch('/api/projects', { method: 'POST', body });
 *
 * Adds `Authorization: Bearer <access token>` (when signed in), and on a `401`
 * refreshes the token once and retries. Same signature as `fetch`.
 *
 * It sends the user's token to whatever URL you give it, so call it for your
 * backend only — never for a third-party URL.
 *
 * A `402 { code: 'QUOTA_EXCEEDED', … }` answer (what bridge-nestjs's
 * `@RequireQuota` sends at the plan's cap) opens the upgrade dialog that
 * `<BridgeProvider>` mounts, whatever origin your backend is on. The response is
 * still returned to you unchanged.
 */
export async function bridgeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetchWithToken(input, init);
  void observeQuotaRefusal(response, absoluteUrl(requestUrl(input)));
  noteBackendResponse(response);
  return response;
}

async function fetchWithToken(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let auth: ReturnType<typeof getBridgeAuth>;
  try {
    auth = getBridgeAuth();
  } catch {
    // Bridge not initialised (SSR, a test) — behave exactly like fetch.
    return fetch(input, init);
  }

  const isRequest = typeof Request !== 'undefined' && input instanceof Request;
  const withToken = (token: string | undefined): RequestInit => {
    const headers = new Headers(init?.headers ?? (isRequest ? (input as Request).headers : undefined));
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return { ...init, headers };
  };

  const sentToken = auth.getTokens()?.accessToken;
  const response = await fetch(input, withToken(sentToken));
  if (response.status !== 401 || !sentToken) return response;

  // A streamed body is gone after the first attempt; it cannot be replayed.
  const streamed = typeof ReadableStream !== 'undefined' && init?.body instanceof ReadableStream;
  if (isRequest || streamed) return response;

  const fresh = await auth.refreshTokens().catch(() => null);
  const freshToken = fresh?.accessToken ?? auth.getTokens()?.accessToken;
  if (!freshToken || freshToken === sentToken) return response;
  return fetch(input, withToken(freshToken));
}

// TBP-762 — reading the canonical billing state (`GET /billing/state`, what
// `<BridgeSubscriptionStatus>`, `<BridgeBillingNotice>` and
// `bridge:billing.plan` flag rules read) through one place. Ported from
// bridge-svelte's `core/billing-store.ts`.
//
//   - concurrent reads share one request; a call made during a read gets one
//     more read after it (the caller asked because something changed);
//   - only a first read shows "Loading…"; a re-read keeps the plan on screen;
//   - a failed read is retried once; a failed re-read keeps the last answer;
//   - an answer that arrives after sign-out or a workspace switch is dropped;
//   - every read renews an out-of-date sign-in (`onTokenStale`).
//
// Kept apart from `billing-refresh.ts` so the startup reads can use it without
// an import cycle (the runtime imports both).

import {
  fetchBillingState,
  useBridge as useBillingBridge,
  type MountOptions,
} from '@nebulr-group/bridge-auth-core';
import { billingRetryDelay, getBridgeAuth } from './bridge-instance';
import { logger } from '../utils/logger';

const DEFAULT_API_BASE_URL = 'https://api.thebridge.dev';

/** A read older than this is re-read when the tab regains focus or a screen mounts. */
export const BILLING_STALE_AFTER_MS = 30_000;

/**
 * The handler that renews an out-of-date sign-in, when the installed auth-core
 * has it (0.8.0-beta.5+; older ones simply do not retry).
 */
function tokenStaleHandler(): (() => Promise<string | null>) | undefined {
  try {
    const auth = getBridgeAuth() as ReturnType<typeof getBridgeAuth> & {
      tokenStaleHandler?: () => () => Promise<string | null>;
    };
    return typeof auth.tokenStaleHandler === 'function' ? auth.tokenStaleHandler() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * HTTP options for a billing read: the current token and the handler that
 * renews an out-of-date one. Null when signed out or before Bridge is set up.
 */
export function billingReadOptions(): MountOptions | null {
  try {
    const ctx = getBridgeAuth().getApiContext();
    if (!ctx.accessToken) return null;
    return {
      apiBaseUrl: ctx.apiBaseUrl ?? DEFAULT_API_BASE_URL,
      accessToken: ctx.accessToken,
      appId: ctx.appId,
      onTokenStale: tokenStaleHandler(),
    };
  } catch {
    return null;
  }
}

let _inflight: Promise<void> | null = null;
let _again = false;
let _loadedAt = 0;
let _wanted = false;
let _readToken: string | null = null;

/** True once a billing screen has asked for the billing state in this session. */
export function billingStateWanted(): boolean {
  return _wanted;
}

/** The access token the latest billing-state read started with. */
export function billingStateReadToken(): string | null {
  return _readToken;
}

/** Re-read the canonical billing state. Never rejects. */
export function refreshBillingState(): Promise<void> {
  if (_inflight) {
    _again = true;
    return _inflight;
  }
  _inflight = (async () => {
    try {
      do {
        _again = false;
        await readStateOnce();
      } while (_again);
    } finally {
      _inflight = null;
    }
  })();
  return _inflight;
}

/**
 * What a billing screen calls on mount: read unless a read younger than
 * `maxAgeMs` exists, and mark the billing state as wanted so the refresh rule
 * keeps it current. Never rejects.
 */
export function ensureBillingState(maxAgeMs = BILLING_STALE_AFTER_MS): Promise<void> {
  _wanted = true;
  if (_inflight) return _inflight;
  try {
    const sub = useBillingBridge().subscription;
    if (_loadedAt > 0 && sub.snapshot().state && Date.now() - _loadedAt < maxAgeMs) {
      return Promise.resolve();
    }
  } catch {
    return Promise.resolve();
  }
  return refreshBillingState();
}

async function readStateOnce(): Promise<void> {
  let sub: ReturnType<typeof useBillingBridge>['subscription'];
  try {
    sub = useBillingBridge().subscription;
  } catch {
    return; // billing surface unavailable
  }
  const hadState = sub.snapshot().state !== null;
  // Only a first read shows "Loading…"; a re-read keeps the plan on screen.
  if (!hadState) {
    sub.setError(null);
    sub.setLoading(true);
  }
  try {
    for (let attempt = 0; ; attempt++) {
      const opts = billingReadOptions();
      if (!opts) {
        if (!sub.snapshot().state) sub.setError('Not authenticated');
        return;
      }
      _readToken = opts.accessToken;
      try {
        const state = await fetchBillingState(opts, logger);
        // Signed out or switched workspace meanwhile: not this session's plan.
        if (tokenChangedWorkspace(opts.accessToken)) return;
        sub.hydrate(state);
        _loadedAt = Date.now();
        return;
      } catch (err) {
        if (attempt === 0) {
          // The one retry. "Loading…" stays up meanwhile — a checkout that is
          // still being confirmed is not an error.
          await new Promise((r) => setTimeout(r, billingRetryDelay()));
          continue;
        }
        const message = err instanceof Error ? err.message : 'Failed to load billing state';
        logger.warn('[bridge-billing] billing state read failed:', message);
        if (!sub.snapshot().state) sub.setError(message);
        return;
      }
    }
  } finally {
    if (!hadState) sub.setLoading(false);
  }
}

function workspaceOf(token: string | null | undefined): string | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { tid?: unknown };
    return typeof json.tid === 'string' ? json.tid : null;
  } catch {
    return null;
  }
}

/** True when the session now belongs to a different workspace (or none) than `token`. */
function tokenChangedWorkspace(token: string): boolean {
  const now = billingReadOptions()?.accessToken ?? null;
  if (!now) return true;
  return workspaceOf(now) !== workspaceOf(token);
}

/** Test-only. */
export function __resetBillingStateForTests(): void {
  _inflight = null;
  _again = false;
  _loadedAt = 0;
  _wanted = false;
  _readToken = null;
}

// TBP-945 (port of bridge-svelte TBP-813) — "a checkout just finished", for
// whichever page it lands on.
//
// A completed checkout used to stop on a confirmation page
// (`/subscription/success`) before going anywhere. It now lands on
// `billing.successRoute` (the subscription page by default), and this one-shot
// signal is how that page knows to say so: `<BridgeCheckoutNotice>` shows it as
// a banner, and an app that wants its own message reads `useCheckoutResult()`.
//
// In memory, never in the URL. With a router adapter (React Router, TanStack
// Router) the checkout return and a Free pick navigate inside the running app,
// so the signal is still here when the landing page renders. Unlike
// bridge-svelte, a React app may run without a router adapter, and then the
// SDK navigates with `window.location`, which reloads the page. For that one
// page load only, the signal is handed over in `sessionStorage`: the next load
// moves it back into memory and deletes the key at once, so a later reload
// (or a later visit) never shows it again. Whoever shows it clears it.

import { useSyncExternalStore } from 'react';

/** What just completed. */
export interface BridgeCheckoutResult {
  /** `checkout`: a paid Stripe checkout returned. `plan`: a plan was set without one (a Free pick). */
  kind: 'checkout' | 'plan';
  /** The plan's name, when the page that set it knew it. Otherwise read the current plan. */
  planName?: string;
}

const STORAGE_KEY = 'bridge:checkout-result';
/** A hand-over older than this is from some earlier visit, not the page load that just happened. */
const HANDOVER_MAX_AGE_MS = 2 * 60 * 1000;

type Listener = () => void;

let result: BridgeCheckoutResult | null = readHandover();
const listeners = new Set<Listener>();

function isResult(value: unknown): value is BridgeCheckoutResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (v.kind === 'checkout' || v.kind === 'plan') && (v.planName === undefined || typeof v.planName === 'string');
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' && window.sessionStorage ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

/** Take the hand-over left by the page load before this one, and delete it. */
function readHandover(): BridgeCheckoutResult | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(STORAGE_KEY);
    if (raw === null) return null;
    s.removeItem(STORAGE_KEY);
    const parsed = JSON.parse(raw) as { at?: unknown; result?: unknown };
    if (typeof parsed.at !== 'number' || Date.now() - parsed.at > HANDOVER_MAX_AGE_MS) return null;
    return isResult(parsed.result) ? { ...parsed.result } : null;
  } catch {
    return null;
  }
}

function writeHandover(value: BridgeCheckoutResult | null): void {
  const s = storage();
  if (!s) return;
  try {
    if (value) s.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now(), result: value }));
    else s.removeItem(STORAGE_KEY);
  } catch {
    /* storage full or blocked: the in-memory signal still works in-app */
  }
}

function set(value: BridgeCheckoutResult | null): void {
  if (value === result) return;
  result = value;
  writeHandover(value);
  for (const listener of [...listeners]) listener();
}

/** Record a completed checkout or plan pick. Called by the SDK, not by apps. */
export function markCheckoutComplete(value: BridgeCheckoutResult): void {
  set({ ...value });
}

/** The checkout that just completed, or `null`, without clearing it. */
export function getCheckoutResult(): BridgeCheckoutResult | null {
  return result;
}

/** Read the result and clear it, so it is shown once. */
export function takeCheckoutResult(): BridgeCheckoutResult | null {
  const value = result;
  if (value) set(null);
  return value;
}

/** Forget the result without showing it. */
export function clearCheckoutResult(): void {
  set(null);
}

/** Be told when the result changes. Returns the unsubscribe function. */
export function subscribeCheckoutResult(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The checkout that just completed, or `null`; re-renders when it changes.
 * Reading does not clear it: call `takeCheckoutResult()` (or
 * `clearCheckoutResult()`) once your page has shown its own message.
 */
export function useCheckoutResult(): BridgeCheckoutResult | null {
  return useSyncExternalStore(subscribeCheckoutResult, getCheckoutResult, () => null);
}

/** Test seam: reset the in-memory signal and re-read the hand-over, as a fresh page load would. */
export function __reloadCheckoutResultForTests(): void {
  result = readHandover();
  for (const listener of [...listeners]) listener();
}

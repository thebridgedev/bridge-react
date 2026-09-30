// TBP-743 (port of bridge-svelte TBP-696) — one route serves every sign-in page.
//
// An app used to hand-write a route per auth page, and the one it most often
// skipped — `set-password/:token`, because "we don't use passwords" — is the
// address bridge-api writes into every signup verification email. With
// `<BridgeAuthRoutes />` mounted at `/auth/*`, the plugin owns that list, so a
// page cannot be forgotten.
//
// This module is the list and its parser, shared by `<BridgeAuthRoutes>` and
// the router adapters.

/** Every page `<BridgeAuthRoutes>` serves, by its first path segment. */
export const BRIDGE_AUTH_PAGES = [
  'login',
  'signup',
  'oauth-callback',
  'set-password',
  'forgot-password',
  'magic-link',
  'setup-passkey',
  'workspaces',
] as const;

/** One of the pages `<BridgeAuthRoutes>` serves. */
export type BridgeAuthPage = (typeof BRIDGE_AUTH_PAGES)[number];

/** A parsed auth route: which page, and the email-link token where it has one. */
export interface BridgeAuthRoute {
  page: BridgeAuthPage;
  /** The one-time token of `set-password/:token` and `setup-passkey/:token`. */
  token?: string;
}

/** Pages reached from an email link, whose second segment is the token. */
const TOKEN_PAGES: ReadonlySet<string> = new Set(['set-password', 'setup-passkey']);

/**
 * Parse the part of the path below the mount point (`login`,
 * `set-password/abc`) into a page, or `null` when it names no page Bridge
 * serves.
 *
 * Exact shapes only: `login` but not `login/extra`, and `set-password/<token>`
 * but not a bare `set-password`. A page that half-matches would otherwise render
 * a form at an address nobody links to.
 */
export function parseBridgeAuthRoute(rest: string | undefined | null): BridgeAuthRoute | null {
  if (typeof rest !== 'string') return null;
  const segments = rest.split('/').filter((s) => s !== '');
  const [first, token] = segments;
  if (!first || !(BRIDGE_AUTH_PAGES as readonly string[]).includes(first)) return null;
  const page = first as BridgeAuthPage;

  if (TOKEN_PAGES.has(page)) {
    return segments.length === 2 && token ? { page, token: safeDecode(token) } : null;
  }
  return segments.length === 1 ? { page } : null;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * The URL prefix the catch-all lives under: `/auth` for `/auth/login` when the
 * rest is `login`. Links between the pages are built from it, so the catch-all
 * can be mounted anywhere, not only at `/auth`.
 */
export function bridgeAuthBase(pathname: string, rest: string | undefined | null): string {
  // Count segments rather than comparing text: `pathname` is URL-encoded and
  // the rest may be decoded, so a token with an escaped character would not match.
  const restCount = (rest ?? '').split('/').filter((s) => s !== '').length;
  const segments = pathname.split('/').filter((s) => s !== '');
  const kept = segments.slice(0, Math.max(0, segments.length - restCount));
  return kept.length ? `/${kept.join('/')}` : '';
}

/**
 * The rest of `pathname` below `base` (`/auth/login` under `/auth` → `login`),
 * or `null` when `pathname` is not under `base`. Used when no router supplies
 * the matched splat.
 */
export function restBelow(pathname: string, base: string): string | null {
  const b = base.replace(/\/+$/, '');
  if (b === '') return pathname.replace(/^\/+/, '');
  if (pathname === b) return '';
  if (!pathname.startsWith(`${b}/`)) return null;
  return pathname.slice(b.length + 1);
}

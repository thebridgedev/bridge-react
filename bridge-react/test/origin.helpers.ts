/**
 * TBP-669 test helper — serve the page from a given origin, the way a real app
 * lives on an origin Bridge may or may not allow.
 *
 * Installs a `URL` as `location` rather than navigating happy-dom: other test
 * files in the same `bun test` process replace `window.location` with plain
 * objects, after which happy-dom's own URL no longer reaches it. Restores the
 * previous descriptor, and fails loud if the page still reports another origin.
 */
export function setPageOrigin(origin: string, pathAndQuery = '/login'): () => void {
  const targets = [...new Set<object>([globalThis, (globalThis as { window?: object }).window ?? globalThis])];
  const previous = targets.map((t) => [t, Object.getOwnPropertyDescriptor(t, 'location')] as const);
  const url = new URL(pathAndQuery, origin);
  for (const t of targets) Object.defineProperty(t, 'location', { configurable: true, writable: true, value: url });
  if (globalThis.location?.origin !== origin) {
    throw new Error(`page origin is ${globalThis.location?.origin}, expected ${origin}`);
  }
  return () => {
    for (const [t, d] of previous) {
      if (d) Object.defineProperty(t, 'location', d);
      else delete (t as { location?: unknown }).location;
    }
  };
}

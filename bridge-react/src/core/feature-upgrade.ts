/**
 * TBP-743 (port of bridge-svelte TBP-756) — "this feature is not on your
 * plan", as an event the upgrade dialog listens to.
 *
 * Owner rule: nothing opens by itself. The upgrade dialog's feature variant
 * opens only when the person does something gated:
 *   - clicks the upgrade prompt a `<FeatureFlag>` shows (its fallback's
 *     `openUpgrade`, or the opt-in `upgrade` prompt);
 *   - makes a request the backend refuses with `402 FEATURE_NOT_IN_PLAN`
 *     (bridge-nestjs's flag guards), like the `402 QUOTA_EXCEEDED` dialog.
 * A hidden feature with no fallback opens nothing.
 *
 * Plain module state with a subscribe/getSnapshot pair, so it works with
 * `useSyncExternalStore` and has no auth dependency (the `/flags` entry,
 * which is auth-free, imports it through `<FeatureFlag>`).
 */

/** A request to show the upgrade dialog for a feature the plan does not include. */
export interface BridgeFeatureUpgrade {
  /** The feature flag that is off. */
  flag: string | null;
  /**
   * The plan feature the flag's rule asks for (`bridge:billing.entitlement.<feature>`),
   * when it names one. The dialog lists the plans that include it.
   */
  feature: string | null;
  /** Where to upgrade, from a backend refusal's `fix` (a same-app path), else null. */
  fix: string | null;
}

/**
 * A same-app path, or null. A backend's `fix` becomes a link the user clicks,
 * so an absolute URL, a protocol-relative `//host` or a `javascript:` value is
 * never followed — the configured subscription page is used instead.
 */
export function safeFixPath(fix: unknown): string | null {
  if (typeof fix !== 'string') return null;
  const value = fix.trim();
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null;
  if (/[\u0000-\u001f]/.test(value)) return null;
  return value;
}

let _current: BridgeFeatureUpgrade | null = null;
const _listeners = new Set<() => void>();

function emit(): void {
  for (const l of [..._listeners]) {
    try {
      l();
    } catch {
      /* one broken listener must not stop the others */
    }
  }
}

/** The feature upgrade the dialog is showing, or `null`. */
export function getFeatureUpgrade(): BridgeFeatureUpgrade | null {
  return _current;
}

/** Subscribe to changes of {@link getFeatureUpgrade}. Returns an unsubscribe. */
export function subscribeFeatureUpgrade(listener: () => void): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

/**
 * Open the upgrade dialog for a feature the plan does not include. Call it from
 * a click; a render must never call it (owner rule: nothing opens by itself).
 */
export function openFeatureUpgrade(
  request: { flag?: string | null; feature?: string | null; fix?: string | null } = {},
): void {
  _current = {
    flag: request.flag ?? null,
    feature: request.feature ?? null,
    fix: safeFixPath(request.fix),
  };
  emit();
}

/** Close the feature variant of the upgrade dialog. */
export function dismissFeatureUpgrade(): void {
  if (_current === null) return;
  _current = null;
  emit();
}

/**
 * The upgrade request in a `402 FEATURE_NOT_IN_PLAN` body (bridge-nestjs), or
 * null when the body is something else.
 */
export function parseFeatureRefusal(body: unknown): BridgeFeatureUpgrade | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (b.code !== 'FEATURE_NOT_IN_PLAN') return null;
  return {
    flag: typeof b.flag === 'string' && b.flag ? b.flag : null,
    feature: typeof b.feature === 'string' && b.feature ? b.feature : null,
    fix: safeFixPath(b.fix),
  };
}

/** @internal Test-only: forget the current request and listeners. */
export function __resetFeatureUpgradeForTests(): void {
  _current = null;
  _listeners.clear();
}

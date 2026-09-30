
// bridge-nextjs — declarative component for Bridge feature flags (FF 2.0).
//
// React translation of bridge-svelte's `FeatureFlag.svelte` (§5.1 / §5.4).
//
//   - svelte `children` snippet  → React `children` (node or render-prop `(value) => node`)
//   - svelte `fallback` snippet  → React `fallback` (node or render-prop)
//   - svelte `$derived.by(() => { _flagVersionsRune().get(key); evaluateFlag(...) })`
//     → `useFlag(...)` (useSyncExternalStore over the registry change-bus)
//
// Prop naming note: React reserves the literal prop name `key` for its
// reconciliation — a component can never receive a prop called `key`. The
// flag key is therefore passed as `flagKey`. All other props mirror svelte
// (`defaultValue`, `context`). The legacy `flagName` / `negate` / `forceLive`
// props are intentionally GONE (hard-replace, no deprecated shim).

import { ReactNode } from 'react';
import type { EvalContext, FlagOffReason } from '@nebulr-group/bridge-auth-core';
import { useFlag } from './use-flag';

type FlagChild<T> = ReactNode | ((value: T) => ReactNode);

/**
 * TBP-756 — what a `<FeatureFlag>` fallback learns about why the feature is
 * off: `reason` is `'plan'` (an upgrade alone would turn it on),
 * `'permission'` (this person's role or privileges), `'off'`, `'rule'`,
 * `'rollout'`, or undefined when Bridge has not said (the flag is not loaded
 * yet). With `'plan'`, `feature` is the plan feature the rule asks for.
 */
export interface FeatureFlagOffInfo {
  reason: FlagOffReason | undefined;
  feature: string | undefined;
}

type FallbackChild<T> = ReactNode | ((value: T, off: FeatureFlagOffInfo) => ReactNode);

export interface FeatureFlagProps<T = boolean> {
  /**
   * The flag key to evaluate. Named `flagKey` rather than `key` because React
   * reserves `key` for reconciliation and never forwards it to a component.
   */
  flagKey: string;
  /** Developer-supplied default returned until the cache resolves / when off. */
  defaultValue: T;
  /**
   * Optional per-call EvalContext. Use when a flag's rule targets dev-supplied
   * attributes (e.g. `{ attributes: { plan } }`). Per-call attributes win on
   * key collision over Bridge-managed providers.
   */
  context?: Partial<EvalContext>;
  /** Rendered when the rule passed. Node, or a render-prop `(value) => node`. */
  children?: FlagChild<T>;
  /**
   * Rendered when the flag is off / no rule matched. Node, or a render-prop
   * `(value, { reason, feature }) => node` (TBP-756) — e.g. offer an upgrade
   * only when `reason === 'plan'`.
   */
  fallback?: FallbackChild<T>;
}

function render<T>(child: FlagChild<T> | undefined, value: T): ReactNode {
  if (child === undefined) return null;
  return typeof child === 'function' ? (child as (v: T) => ReactNode)(value) : child;
}

function renderFallback<T>(child: FallbackChild<T> | undefined, value: T, off: FeatureFlagOffInfo): ReactNode {
  if (child === undefined) return null;
  return typeof child === 'function'
    ? (child as (v: T, o: FeatureFlagOffInfo) => ReactNode)(value, off)
    : child;
}

/**
 * Conditionally render based on a Bridge feature flag.
 *
 * @example
 * <FeatureFlag flagKey="new-dashboard" defaultValue={false}>
 *   <NewDashboard />
 * </FeatureFlag>
 *
 * @example
 * <FeatureFlag flagKey="ui-theme" defaultValue="light-mode">
 *   {(value) => <App theme={value} />}
 * </FeatureFlag>
 *
 * @example
 * <FeatureFlag flagKey="plan-flag" defaultValue={false} context={{ attributes: { plan } }}>
 *   {() => <Enterprise />}
 * </FeatureFlag>
 *
 * @example
 * <FeatureFlag
 *   flagKey="reports"
 *   defaultValue={false}
 *   fallback={(_value, { reason }) => (reason === 'plan' ? <UpgradeForReports /> : null)}
 * >
 *   <Reports />
 * </FeatureFlag>
 */
export function FeatureFlag<T = boolean>({
  flagKey,
  defaultValue,
  context,
  children,
  fallback,
}: FeatureFlagProps<T>) {
  const { value, passed, reason, feature } = useFlag<T>(flagKey, defaultValue, context);
  return <>{passed ? render(children, value) : renderFallback(fallback, value, { reason, feature })}</>;
}

export default FeatureFlag;

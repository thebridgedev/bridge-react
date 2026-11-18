/**
 * `<Entitled to="analytics">`: the children render when the plan has the feature,
 * `fallback` when it does not.
 *
 * ```tsx
 * <Entitled to="analytics" fallback={<a href="/subscription">Upgrade for analytics</a>}>
 *   <AnalyticsPanel />
 * </Entitled>
 * ```
 *
 * Until Bridge has answered (`useEntitlements().ready`) it renders neither, only
 * the optional `loading` node, so a cold start never flashes the upgrade prompt
 * at a paying workspace, nor the paid feature at a free one.
 *
 * It reads the flag `bridge:billing.entitlement.<to>`, as
 * `useEntitlements().can('analytics')` does. To show something for a flag in
 * general, with its reason, use `<FeatureFlag flagKey>`.
 */
import type { ReactNode } from 'react';
import { useEntitlements } from '../../react/entitlements.js';

export interface EntitledProps {
	/** The plan feature's key, such as `analytics`. */
	readonly to: string;
	/** Rendered when the plan has `to`. */
	readonly children?: ReactNode;
	/** Rendered when Bridge has answered and the plan does not have `to`. */
	readonly fallback?: ReactNode;
	/** Rendered until Bridge has answered. Nothing by default. */
	readonly loading?: ReactNode;
}

export function Entitled({ to, children, fallback = null, loading = null }: EntitledProps) {
	const entitlements = useEntitlements();
	if (!entitlements.ready) return <>{loading}</>;
	return <>{entitlements.can(to) ? children : fallback}</>;
}

export default Entitled;

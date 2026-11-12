/**
 * Shows its children when a flag is on, and `fallback` when it is off.
 *
 * `fallback` learns why the feature is off: `reason` is `'plan'` when the
 * flag's rule needs a plan feature the workspace lacks (with `entitlement`
 * naming it), `'off'` otherwise, and `openUpgrade()` opens the upgrade
 * dialog. With `upgrade` and no `fallback`, a feature off because of the plan
 * shows a small upgrade prompt in its place.
 *
 * ```tsx
 * <FeatureFlag flagKey="reports"><Reports /></FeatureFlag>
 * <FeatureFlag flagKey="reports" upgrade><Reports /></FeatureFlag>
 * <FeatureFlag flagKey="reports" fallback={(value, off) => <Locked reason={off.reason} />}>…</FeatureFlag>
 * ```
 *
 * (`key` is React's own prop, so the flag's key is `flagKey`.)
 */
import type { ReactNode } from 'react';
import type { BridgeMessages } from '../../core/config.js';
import { openUpgrade } from '../../core/upgrade.js';
import { useBridge, useFlags, useFlagsStatus, useTranslator } from '../../react/hooks.js';

export interface FeatureFlagOffInfo {
	/** `plan`: an upgrade would turn it on. `off`: anything else. Undefined while results load. */
	readonly reason: 'plan' | 'off' | undefined;
	/** With `plan`: the plan feature the rule needs. */
	readonly entitlement: string | null;
	/** Bridge's own words for which part of the rule decided, when it says. */
	readonly why: string | null;
	/** Opens the upgrade dialog. Call it from a click. */
	readonly openUpgrade: () => void;
}

export interface FeatureFlagProps<T = boolean> {
	readonly flagKey: string;
	/** The value while Bridge gave none. @default false */
	readonly defaultValue?: T;
	/** Show an upgrade prompt when the plan is why it is off and there is no `fallback`. */
	readonly upgrade?: boolean;
	/** What to show when it is on: nodes, or a function of the flag's value. */
	readonly children?: ReactNode | ((value: T) => ReactNode);
	/** What to show when it is off: nodes, or a function of the value and why it is off. */
	readonly fallback?: ReactNode | ((value: T, off: FeatureFlagOffInfo) => ReactNode);
	readonly messages?: BridgeMessages;
}

export function FeatureFlag<T = boolean>({ flagKey, defaultValue = false as T, upgrade = false, children, fallback, messages }: FeatureFlagProps<T>) {
	const t = useTranslator(messages);
	const client = useBridge();
	useFlags();
	const status = useFlagsStatus();

	const value = client === null ? defaultValue : client.flags.get<T>(flagKey, defaultValue);
	const on = typeof value === 'boolean' ? value : value !== defaultValue && value !== null && value !== undefined;
	if (on) return <>{typeof children === 'function' ? (children as (value: T) => ReactNode)(value) : children}</>;

	const why = client?.flags.reason(flagKey) ?? null;
	const entitlement = why?.entitlement ?? null;
	const loaded = status === 'ready' || status === 'error';
	const off: FeatureFlagOffInfo = {
		reason: !loaded ? undefined : entitlement !== null ? 'plan' : 'off',
		entitlement,
		why: why?.why ?? null,
		openUpgrade: () => openUpgrade({ kind: 'feature', flag: flagKey, entitlement }),
	};
	if (fallback !== undefined) return <>{typeof fallback === 'function' ? (fallback as (value: T, off: FeatureFlagOffInfo) => ReactNode)(value, off) : fallback}</>;
	if (upgrade && off.reason === 'plan') {
		return (
			<button type="button" className="bridge-btn bridge-btn-outline" data-bridge-feature-upgrade={flagKey} onClick={off.openUpgrade}>
				{t('feature.upgrade')}
			</button>
		);
	}
	return null;
}

export default FeatureFlag;

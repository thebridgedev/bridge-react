/**
 * TBP-743 (port of bridge-svelte TBP-697) — `useEntitlements()`: the
 * workspace's plan entitlements, from the React plugin alone.
 *
 *   const entitlements = useEntitlements();
 *   if (!entitlements.ready) return <Spinner />;
 *   return entitlements.can('ai_completions') ? <AiPanel /> : <UpgradeForAi />;
 *
 * The standard gate is a flag ruled `bridge:billing.entitlement.<key> eq true`
 * (`<FeatureFlag flagKey>`); this hook reads the plan directly and is the
 * exception for when the developer asks for no flag. In development the first
 * `can()` call logs a one-time note saying so.
 *
 * `can(key)` is fail-closed: `false` until Bridge has answered, and `false` for
 * a key the plan does not grant. `ready` is what tells those two apart.
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useBridge as useBillingBridge } from '@nebulr-group/bridge-auth-core';
import { useBridgeStore } from '../core/bridge-instance';
import { useSnapshotStore } from '../core/snapshot-stores';
import { noteDirectPlanCheck } from '../core/direct-plan-check-note';

export interface EntitlementsState {
  /** True once Bridge has answered for this session. Before that, every `can()` is `false`. */
  readonly ready: boolean;
  /** Fail-closed: `true` only when the plan grants `key`. */
  can(key: string): boolean;
  /** Every entitlement Bridge sent, as `{ key: boolean }`. Empty until `ready`. */
  readonly all: Readonly<Record<string, boolean>>;
}

type EntitlementsStore = ReturnType<typeof useBillingBridge>['entitlementsStore'];

function coreStore(): EntitlementsStore | null {
  try {
    return useBillingBridge().entitlementsStore;
  } catch {
    return null;
  }
}

// auth-core's own entitlement cache — the fallback for the moment before the
// first session snapshot lands. Its `all()` returns a fresh object, so the
// snapshot is memoised by the serialised map.
let _coreKey = '';
let _coreValue: Record<string, boolean> | null = null;
function readCore(): Record<string, boolean> | null {
  const store = coreStore();
  const hydrated = store && typeof store.isHydrated === 'function' ? store.isHydrated() : false;
  if (!store || !hydrated) {
    _coreKey = '';
    _coreValue = null;
    return null;
  }
  const map = store.all() as Record<string, boolean>;
  const key = JSON.stringify(map);
  if (key !== _coreKey || _coreValue === null) {
    _coreKey = key;
    _coreValue = map;
  }
  return _coreValue;
}

/** Build the state for a map (or `null`: not answered yet). */
export function entitlementsStateOf(map: Record<string, boolean> | null): EntitlementsState {
  const all = Object.freeze({ ...(map ?? {}) });
  return Object.freeze({
    ready: map !== null,
    all,
    can: (key: string) => {
      noteDirectPlanCheck('can', key);
      return all[key] === true;
    },
  });
}

const NOT_READY = entitlementsStateOf(null);

/** The workspace's plan entitlements, live. */
export function useEntitlements(): EntitlementsState {
  const signedIn = useBridgeStore((s) => !!s.tokens?.accessToken);
  const snapshot = useSnapshotStore((s) => s.tenantEntitlements);
  const subscribe = useCallback((onChange: () => void) => {
    const store = coreStore();
    return store ? store.subscribe(() => onChange()) : () => {};
  }, []);
  const core = useSyncExternalStore(subscribe, readCore, readCore);

  return useMemo(() => {
    // Signed out: whatever the last session was entitled to is not this one's.
    if (!signedIn) return NOT_READY;
    return entitlementsStateOf(snapshot ?? core);
  }, [signedIn, snapshot, core]);
}

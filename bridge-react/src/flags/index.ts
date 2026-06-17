// bridge-react/flags — public barrel for the Feature Flags 2.0 client surface.
//
// Import from `@nebulr-group/bridge-react/flags` for the flag-only surface, or
// from the main entry `@nebulr-group/bridge-react` (which re-exports everything
// here). FF 2.0 is registry + singleton based and rides on the core Bridge
// runtime mounted by `<BridgeProvider>`; this replaced the legacy provider-based
// FF on the svelte-parity rework (no deprecated shim).
//
// Ported from bridge-nextjs's `src/flags/index.ts` (§5.5 sibling delta — drop
// `'use client'`, no server surface). The shared `registry.ts` is plain TS and
// is safe in any context.

// Bootstrap + browser storage
export {
  createBridgeFlags,
  BrowserIdentityStorage,
  type CreateBridgeFlagsConfig,
  type BridgeFlagsBundle,
} from './bootstrap';

// Non-React registry surface — safe in any TS context (tests, plain TS)
export {
  evaluateFlag,
  setBridgeFlagsInstance,
  getBridgeFlagsInstance,
  notifyFlagChanged,
  notifyAllFlagsChanged,
  subscribeToFlagChanges,
} from './registry';

// React reactive helpers — pull in hooks, only safe inside client components.
export { useFlag, flagStore, type FlagStore } from './use-flag';

// Component
export { FeatureFlag, default as FeatureFlagComponent, type FeatureFlagProps } from './FeatureFlag';

// Reactive realtime connection status (subscribe in components to show
// offline indicators, retry banners, etc.).
export { realtimeStatus, useRealtimeStatus } from './realtime-status';

// Auth-core re-exports — consumers can stay on the `/flags` path without
// adding a direct dependency on `@nebulr-group/bridge-auth-core`. Mirrors
// bridge-svelte's flags/index.ts re-export list.
export {
  BridgeFlags,
  MemoryIdentityStorage,
  attachIdentity,
  generateAnonymousId,
  BRIDGE_CONTEXT_HEADER,
  serializeContext,
  deserializeContext,
  serverInstanceId,
} from '@nebulr-group/bridge-auth-core';

export type {
  CachedFlag,
  FlagValueType,
  FlagEvalResult,
  EvalTelemetry,
  DiscoveryTelemetry,
  BridgeFlagsHooks,
  DeclaredAttributeType,
  AttributeDeclaration,
  BridgeFlagsMode,
  EvalContext,
  IdentityStorage,
  AnonymousTrackingMode,
  BridgeIdentity,
  RealtimeMessage,
  ConnectionState,
} from '@nebulr-group/bridge-auth-core';

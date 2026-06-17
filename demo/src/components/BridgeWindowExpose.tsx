import { useEffect } from 'react';
import { bridge } from '@nebulr-group/bridge-react';

/**
 * Exposes the unified `bridge` surface on `window.bridge` for Playwright E2E
 * (the unified-bridge-surface spec reads `window.bridge.tenant.id`, etc.).
 *
 * Demo/e2e-only — production apps never need this. Mounted inside
 * `<BridgeProvider>` so the surface is the same singleton the runtime populates
 * from `session.snapshot`.
 */
export function BridgeWindowExpose() {
  useEffect(() => {
    (window as unknown as { bridge?: typeof bridge }).bridge = bridge;
  }, []);
  return null;
}

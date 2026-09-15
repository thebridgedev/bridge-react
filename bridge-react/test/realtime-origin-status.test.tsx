/**
 * TBP-669 — a realtime refusal because this page's origin is missing from the
 * app's allowed origins reads as `origin_not_allowed`, side `config`, with the
 * fix — in `realtimeStatusDetail` and in the dev badge — whichever auth-core
 * is installed (`/realtime/diagnose` itself says side `app`).
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { RealtimeStatus } from '@nebulr-group/bridge-auth-core';
import { RealtimeDevBadge } from '../src/components/developer/RealtimeDevBadge';
import { realtimeBadgeView } from '../src/core/realtime-dev-badge';
import {
  _setRealtimeStatusDetail,
  normalizeRealtimeStatus,
  realtimeStatusDetail,
} from '../src/core/realtime-status';
import { setPageOrigin } from './origin.helpers';

const ORIGIN = 'http://localhost:5181';
const ADMIN_PATH = 'Authentication → Security → Allowed Origins';
type WithHint = RealtimeStatus & { hint?: string };

// What an auth-core before TBP-669 passes through from /realtime/diagnose.
const fromServer: RealtimeStatus = {
  state: 'unauthorized',
  reason: 'origin_not_allowed',
  side: 'app',
  retrying: false,
  docsUrl: 'https://thebridge.dev/docs/live-updates/troubleshooting/#origin_not_allowed',
  ref: 'r1',
  since: 1,
};

function currentDetail(): WithHint {
  let value: RealtimeStatus | undefined;
  realtimeStatusDetail.subscribe((v) => (value = v))();
  return value as WithHint;
}

const originalEnv = process.env.NODE_ENV;
let restoreOrigin: () => void;
beforeEach(() => {
  restoreOrigin = setPageOrigin(ORIGIN);
  process.env.NODE_ENV = 'development';
});
afterEach(() => {
  cleanup();
  restoreOrigin();
  process.env.NODE_ENV = originalEnv;
  _setRealtimeStatusDetail({ state: 'idle', retrying: false, since: 0 });
});

describe('realtimeStatusDetail — origin_not_allowed', () => {
  it('is side config with the fix, whatever side the server reported', () => {
    _setRealtimeStatusDetail(fromServer);
    const status = currentDetail();
    expect(status).toMatchObject({ state: 'unauthorized', reason: 'origin_not_allowed', side: 'config' });
    expect(status.hint).toContain(ORIGIN);
    expect(status.hint).toContain(ADMIN_PATH);
  });

  it('keeps a hint auth-core already supplied, and leaves other reasons untouched', () => {
    const withHint = { ...fromServer, side: 'config', hint: 'from auth-core' } as WithHint;
    expect((normalizeRealtimeStatus(withHint) as WithHint).hint).toBe('from auth-core');
    const other: RealtimeStatus = { ...fromServer, reason: 'expired', side: 'app' };
    expect(normalizeRealtimeStatus(other)).toBe(other);
  });
});

describe('dev badge — origin_not_allowed', () => {
  it('names the allowed origins, not apiBaseUrl / appId, and shows the fix', () => {
    const view = realtimeBadgeView({ ...fromServer, state: 'degraded', side: 'config' }, undefined, 0);
    expect(view?.reason).toBe('origin_not_allowed');
    expect(view?.sideLabel).toMatch(/allowed origins/);
    expect(view?.sideLabel).not.toMatch(/apiBaseUrl/);
    expect(view?.hint).toContain(ORIGIN);
    expect(view?.hint).toContain(ADMIN_PATH);
  });

  it('shows while open when some channels were refused with a reason, and not otherwise', () => {
    const partial: RealtimeStatus = { state: 'open', reason: 'origin_not_allowed', side: 'config', retrying: false, since: 1 };
    expect(realtimeBadgeView(partial, undefined, 0)).toMatchObject({ reason: 'origin_not_allowed' });
    expect(realtimeBadgeView({ state: 'open', retrying: false, since: 1 }, undefined, 0)).toBeNull();
  });

  it('adds no hint for reasons it has no fix sentence for', () => {
    const view = realtimeBadgeView({ ...fromServer, reason: 'wrong_environment', side: 'config' }, undefined, 0);
    expect(view?.hint).toBeUndefined();
  });

  it('<RealtimeDevBadge> renders the origin_not_allowed label and a Fix row', () => {
    _setRealtimeStatusDetail(fromServer);
    const { container } = render(<RealtimeDevBadge />);
    fireEvent.click(container.querySelector<HTMLButtonElement>('[aria-controls="bridge-realtime-dev-badge-panel"]')!);
    const panel = container.querySelector('#bridge-realtime-dev-badge-panel')!;
    expect(panel.textContent).toContain('origin_not_allowed');
    expect(panel.textContent).toContain("this page's origin is not in the app's allowed origins");
    const hint = container.querySelector('[data-testid="bridge-realtime-dev-badge-hint"]');
    expect(hint?.textContent).toContain(ORIGIN);
    expect(hint?.textContent).toContain(ADMIN_PATH);
  });
});

/**
 * TBP-644 — the development-only "Live updates off — why?" badge.
 *
 * Rendered for real (happy-dom via the bunfig preload). `process.env.NODE_ENV`
 * is read at render time, so flipping it here is exactly what a production
 * bundle's text substitution does.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import type { RealtimeStatus } from '@nebulr-group/bridge-auth-core';
import { RealtimeDevBadge } from '../src/components/developer/RealtimeDevBadge';
import { BridgeProvider } from '../src/providers/bridge-provider';
import { _setRealtimeStatusDetail } from '../src/core/realtime-status';
import {
  REALTIME_BADGE_RETRYING_AFTER_MS,
  createRetryClock,
  realtimeBadgeView,
} from '../src/core/realtime-dev-badge';

const unauthorized: RealtimeStatus = {
  state: 'unauthorized',
  reason: 'wrong_app',
  side: 'config',
  retrying: false,
  docsUrl: 'https://thebridge.dev/docs/live-updates/troubleshooting/#wrong_app',
  ref: 'c0ffee42',
  since: 1,
};
const open: RealtimeStatus = { state: 'open', retrying: false, since: 1 };
const retrying: RealtimeStatus = { state: 'closed', reason: 'connection_lost', side: 'network', retrying: true, ref: 'r1', since: 1 };

const originalEnv = process.env.NODE_ENV;

beforeEach(() => {
  process.env.NODE_ENV = 'development';
  _setRealtimeStatusDetail({ state: 'idle', retrying: false, since: 0 });
});
afterEach(() => {
  cleanup();
  process.env.NODE_ENV = originalEnv;
});

const toggle = (c: HTMLElement) => c.querySelector<HTMLButtonElement>('[aria-controls="bridge-realtime-dev-badge-panel"]');

describe('<RealtimeDevBadge>', () => {
  it('shows while live updates are off and expands to the reason, whose side, docs link and ref', () => {
    _setRealtimeStatusDetail(unauthorized);
    const { container, getByText } = render(<RealtimeDevBadge />);
    const button = toggle(container)!;
    expect(button.textContent).toContain('Live updates off — why?');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[aria-live="polite"]')!.textContent).toBe(
      'Bridge live updates are off: wrong_app',
    );

    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const panel = container.querySelector('#bridge-realtime-dev-badge-panel')!;
    expect(panel.textContent).toContain('wrong_app');
    expect(panel.textContent).toContain('c0ffee42');
    expect(getByText(/Your Bridge settings/)).toBeTruthy();
    expect(panel.querySelector('a')!.getAttribute('href')).toBe(unauthorized.docsUrl!);
  });

  it('Escape collapses the panel and returns focus to the toggle', () => {
    _setRealtimeStatusDetail(unauthorized);
    const { container } = render(<RealtimeDevBadge />);
    const button = toggle(container)!;
    fireEvent.click(button);
    fireEvent.keyDown(container.querySelector('#bridge-realtime-dev-badge-panel')!, { key: 'Escape' });
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(button);
  });

  it('dismisses until a NEW problem arrives', () => {
    _setRealtimeStatusDetail(unauthorized);
    const { container, getByLabelText } = render(<RealtimeDevBadge />);
    fireEvent.click(getByLabelText('Dismiss the live updates notice'));
    expect(toggle(container)).toBeNull();

    act(() => _setRealtimeStatusDetail({ ...unauthorized, since: 2 })); // same episode
    expect(toggle(container)).toBeNull();
    act(() => _setRealtimeStatusDetail({ ...unauthorized, ref: 'another1', reason: 'expired', side: 'app' }));
    expect(toggle(container)).not.toBeNull();
  });

  it('renders nothing while live updates work', () => {
    _setRealtimeStatusDetail(open);
    const { container } = render(<RealtimeDevBadge />);
    expect(toggle(container)).toBeNull();
  });

  it('renders nothing at all in a production build', () => {
    process.env.NODE_ENV = 'production';
    _setRealtimeStatusDetail(unauthorized);
    const { container } = render(<RealtimeDevBadge />);
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when opted out', () => {
    _setRealtimeStatusDetail(unauthorized);
    const { container } = render(<RealtimeDevBadge enabled={false} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('<BridgeProvider> mounts the badge', () => {
  // No appId → the provider starts no runtime, so nothing races the status
  // this test sets. The mount itself is what is under test.
  it('without any app code', () => {
    const { container } = render(
      <BridgeProvider config={{}}>
        <div>child</div>
      </BridgeProvider>,
    );
    act(() => _setRealtimeStatusDetail(unauthorized));
    expect(toggle(container)).not.toBeNull();
  });

  it('and respects devBadge: false', () => {
    const { container } = render(
      <BridgeProvider config={{ devBadge: false }}>
        <div>child</div>
      </BridgeProvider>,
    );
    act(() => _setRealtimeStatusDetail(unauthorized));
    expect(container.querySelector('[data-testid="bridge-realtime-dev-badge-root"]')).toBeNull();
    expect(container.textContent).toBe('child');
  });
});

describe('realtimeBadgeView', () => {
  it("shows for 'degraded' and builds the docs link from the reason", () => {
    expect(
      realtimeBadgeView({ state: 'degraded', reason: 'no_channel_accepted', retrying: false, since: 1 }, undefined, 0),
    ).toMatchObject({ docsUrl: 'https://thebridge.dev/docs/live-updates/troubleshooting/#no_channel_accepted' });
  });

  it('shows a retry run only after 30 s, keyed by its ref across state flips', () => {
    expect(realtimeBadgeView(retrying, 0, REALTIME_BADGE_RETRYING_AFTER_MS - 1)).toBeNull();
    const a = realtimeBadgeView(retrying, 0, REALTIME_BADGE_RETRYING_AFTER_MS);
    const b = realtimeBadgeView({ ...retrying, state: 'connecting' }, 0, REALTIME_BADGE_RETRYING_AFTER_MS);
    expect(a?.sideLabel).toMatch(/network/i);
    expect(a?.key).toBe(b?.key);
  });

  it('the retry clock measures from the first status of a run and resets on recovery', () => {
    const clock = createRetryClock();
    expect(clock(retrying, 100)).toBe(100);
    expect(clock({ ...retrying, state: 'connecting' }, 5_000)).toBe(100);
    expect(clock(open, 6_000)).toBeUndefined();
  });
});

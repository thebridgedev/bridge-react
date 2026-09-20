/**
 * TBP-682 — MagicLink must redeem the emailed token, not only send it.
 *
 * auth-core posts `successUrl` = the page the request was made from, and Bridge
 * emails `{successUrl}?bridge_magic_link_token=<token>`. LoginForm has always
 * redeemed that token on mount; MagicLink only ever sent. So a request made
 * from a route that mounts MagicLink emailed a link back to that same route,
 * where nothing redeemed it: the page rendered, the token sat in the address
 * bar, and the user stayed signed out.
 *
 * Everything below drives the real component through a real mount — the only
 * stub is the auth-core call the redeem ends in.
 */
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { StrictMode } from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { HttpError, en } from '@nebulr-group/bridge-auth-core';
import { MagicLink } from '../src/components/sdk-auth/MagicLink';
import {
  getBridgeAuth,
  initBridge,
  setBridgeConfig,
  _resetBridgeInstance,
} from '../src/core/bridge-instance';

/**
 * Serve the page from `pathAndQuery`, with a `history.replaceState` that moves
 * it — which is what the component under test uses to strip the token.
 *
 * Installs its own `location` rather than navigating happy-dom, and restores
 * the previous descriptors: other test files in the same `bun test` process
 * replace `window.location` with plain objects, so neither happy-dom's own
 * location nor a leftover stub can be relied on here (same reasoning as
 * `origin.helpers.ts`).
 */
const ORIGIN = 'http://localhost';
let page: URL;

function servePage(pathAndQuery: string): () => void {
  page = new URL(pathAndQuery, ORIGIN);
  const targets = [...new Set<object>([globalThis, (globalThis as { window?: object }).window ?? globalThis])];
  const previous = targets.map((t) => [t, Object.getOwnPropertyDescriptor(t, 'location')] as const);
  for (const t of targets) {
    Object.defineProperty(t, 'location', { configurable: true, writable: true, value: page });
  }

  const history = { replaceState: (_state: unknown, _title: string, url: string) => { page.href = new URL(url, ORIGIN).href; } };
  const previousHistory = targets.map((t) => [t, Object.getOwnPropertyDescriptor(t, 'history')] as const);
  for (const t of targets) {
    Object.defineProperty(t, 'history', { configurable: true, writable: true, value: history });
  }

  return () => {
    for (const [t, d] of previousHistory) {
      if (d) Object.defineProperty(t, 'history', d);
      else delete (t as { history?: unknown }).history;
    }
    for (const [t, d] of previous) {
      if (d) Object.defineProperty(t, 'location', d);
      else delete (t as { location?: unknown }).location;
    }
  };
}

/** Stub the one auth-core call the redeem ends in. */
function stubRedeem(impl: (token: string) => Promise<unknown>) {
  const spy = mock(impl);
  (getBridgeAuth() as any).authenticateWithMagicLinkToken = spy;
  return spy;
}

const alertText = (c: HTMLElement) => c.querySelector('[role="alert"], .bridge-alert')?.textContent?.trim() ?? '';
const emailField = (c: HTMLElement) => c.querySelector('#magic-email');
const submitButton = (c: HTMLElement) => c.querySelector<HTMLButtonElement>('button[type="submit"]');

/** Let the redeem promise and its `.finally` settle, and React commit. */
async function flush(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

let restorePage: () => void = () => {};

beforeEach(() => {
  _resetBridgeInstance();
  initBridge({ appId: 'tbp-682' } as any);
  setBridgeConfig({ appId: 'tbp-682' } as any);
});

afterEach(() => {
  cleanup();
  restorePage();
  restorePage = () => {};
  _resetBridgeInstance();
  setBridgeConfig(null as any);
});

describe('MagicLink redeems the emailed token on mount (TBP-682)', () => {
  it('redeems the token in the URL and strips it from the address bar', async () => {
    restorePage = servePage('/auth/magic-link?bridge_magic_link_token=tok-1&utm_source=email');
    const redeem = stubRedeem(async () => ({}));

    const { container } = render(<MagicLink />);

    await waitFor(() => expect(redeem).toHaveBeenCalledTimes(1));
    expect(redeem.mock.calls[0][0]).toBe('tok-1');

    // The token is gone, the app's own query survives — a reload or a shared
    // link cannot replay it.
    expect(page.search).toBe('?utm_source=email');
    expect(page.pathname).toBe('/auth/magic-link');
    expect(page.href).not.toContain('bridge_magic_link_token');

    await flush();
    expect(alertText(container)).toBe('');
  });

  it('strips the whole query when the token was the only parameter', async () => {
    restorePage = servePage('/auth/magic-link?bridge_magic_link_token=tok-2');
    const redeem = stubRedeem(async () => ({}));

    render(<MagicLink />);

    await waitFor(() => expect(redeem).toHaveBeenCalledTimes(1));
    expect(page.search).toBe('');
    expect(page.href).toBe('http://localhost/auth/magic-link');
  });

  it('redeems BEFORE the address bar is read again — the token is stripped first', async () => {
    // The strip is what makes the effect replay-safe, so it has to happen on
    // the way in, not in a `.then`. Asserted by reading the URL from inside the
    // stub: by the time auth-core is called, the token is already gone.
    restorePage = servePage('/auth/magic-link?bridge_magic_link_token=tok-3');
    let urlDuringRedeem = '';
    const redeem = stubRedeem(async () => {
      urlDuringRedeem = page.href;
      return {};
    });

    render(<MagicLink />);

    await waitFor(() => expect(redeem).toHaveBeenCalledTimes(1));
    expect(urlDuringRedeem).not.toContain('bridge_magic_link_token');
  });

  it('does nothing when there is no token — the send form renders as before', async () => {
    restorePage = servePage('/auth/magic-link');
    const redeem = stubRedeem(async () => ({}));

    const { container } = render(<MagicLink />);
    await flush();

    expect(redeem).not.toHaveBeenCalled();
    expect(emailField(container)).not.toBeNull();
    expect(submitButton(container)!.textContent).toContain(en['magicLink.submit']);
    expect(alertText(container)).toBe('');
  });

  it('leaves an unrelated query untouched when there is no token', async () => {
    restorePage = servePage('/auth/magic-link?utm_source=email');
    const redeem = stubRedeem(async () => ({}));

    render(<MagicLink />);
    await flush();

    expect(redeem).not.toHaveBeenCalled();
    expect(page.search).toBe('?utm_source=email');
  });

  it('StrictMode double-invoke redeems exactly once', async () => {
    // React's dev double-mount runs the effect twice on the same fiber. No ref
    // guard is needed: the first run strips the token synchronously, so the
    // second finds none — the same shape LoginForm relies on.
    restorePage = servePage('/auth/magic-link?bridge_magic_link_token=tok-4');
    const redeem = stubRedeem(async () => ({}));

    render(
      <StrictMode>
        <MagicLink />
      </StrictMode>,
    );

    await waitFor(() => expect(redeem).toHaveBeenCalledTimes(1));
    await flush();
    expect(redeem).toHaveBeenCalledTimes(1);
    expect(redeem.mock.calls[0][0]).toBe('tok-4');
  });
});

describe('MagicLink surfaces a refused redeem (TBP-682)', () => {
  it('shows the error, calls onError, and leaves the loading state', async () => {
    restorePage = servePage('/auth/magic-link?bridge_magic_link_token=expired');
    const refusal = new HttpError('This magic link has expired.', 401, {
      message: 'This magic link has expired.',
    });
    stubRedeem(async () => {
      throw refusal;
    });
    const onError = mock(() => {});

    const { container } = render(<MagicLink onError={onError} />);

    await waitFor(() => expect(alertText(container)).toBe('This magic link has expired.'));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBe(refusal as never);

    // Loading is over: the form is usable again, so the user can request a
    // fresh link from the same screen.
    await flush();
    expect(submitButton(container)!.textContent).toContain(en['magicLink.submit']);
    expect((emailField(container) as HTMLInputElement).disabled).toBe(false);
  });

  it('falls back to the magicLink.error.auth copy when the failure carries no message', async () => {
    restorePage = servePage('/auth/magic-link?bridge_magic_link_token=nope');
    stubRedeem(async () => {
      throw new Error('');
    });
    const onError = mock(() => {});

    const { container } = render(<MagicLink onError={onError} />);

    await waitFor(() => expect(alertText(container)).toBe(en['magicLink.error.auth']));
    expect(onError).toHaveBeenCalledTimes(1);
  });
});

/**
 * TenantSelector, WorkspaceSelector and SsoButton were missed by TBP-630's
 * original i18n sweep and by the TBP-633 port, so they still rendered English
 * after everything around them had been translated. TenantSelector is the one
 * that stings: it renders MID-LOGIN on the multi-workspace path, putting one
 * English screen between a translated login form and a translated app
 * (TBP-634).
 *
 * Every error string below is produced by driving the REAL failure path — a
 * click on a stubbed API that rejects — not by seeding component state. The
 * distinction matters: a component can hold the right key in its markup and
 * still assign an English literal in its catch block, and only the second of
 * those is what a user in Swedish actually hits.
 */
import { afterEach, describe, expect, it, mock } from 'bun:test';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { TenantSelector } from '../src/components/sdk-auth/TenantSelector';
import { WorkspaceSelector } from '../src/components/sdk-auth/WorkspaceSelector';
import { SsoButton } from '../src/components/sdk-auth/SsoButton';
import { LoginForm } from '../src/components/sdk-auth/LoginForm';
import {
  getBridgeAuth,
  initBridge,
  setBridgeConfig,
  useBridgeStore,
  _resetBridgeInstance,
} from '../src/core/bridge-instance';
import { en, sv } from '@nebulr-group/bridge-auth-core';

afterEach(() => {
  cleanup();
  _resetBridgeInstance();
  setBridgeConfig(null as any);
  useBridgeStore.setState({ tenantUsers: [], authState: null } as any);
});

/** Boot the singleton and point config at a locale, the way an app does. */
function boot(locale?: string) {
  _resetBridgeInstance();
  initBridge({ appId: 'tbp-634' } as any);
  setBridgeConfig({ appId: 'tbp-634', locale } as any);
}

const TENANT = {
  id: 'tu-1',
  fullName: 'Ada Lovelace',
  tenant: { id: 't-1', name: 'Acme', logo: null },
};

const WORKSPACE = {
  id: 'ws-1',
  fullName: 'Ada Lovelace',
  tenant: { id: 't-1', name: 'Acme', logo: null },
};

const CONNECTION = { id: 'google', type: 'google', name: 'Google' } as any;

const alertText = (c: HTMLElement) =>
  c.querySelector('[data-bridge-alert], .bridge-alert')?.textContent?.trim() ??
  c.textContent?.trim();

// ---------------------------------------------------------------------------
// TenantSelector
// ---------------------------------------------------------------------------

describe('TenantSelector heading (TBP-634)', () => {
  it('renders the English heading when no locale is set', () => {
    boot(undefined);
    const { container } = render(<TenantSelector />);
    expect(container.textContent).toContain(en['tenant.chooseHeading']);
  });

  it('renders the Swedish heading at locale sv', () => {
    boot('sv');
    const { container } = render(<TenantSelector />);
    expect(container.textContent).toContain(sv['tenant.chooseHeading']);
    // The English must be GONE, not merely joined by the Swedish — a component
    // rendering both would satisfy a `toContain` on the Swedish alone.
    expect(container.textContent).not.toContain(en['tenant.chooseHeading']);
  });

  it('lets a per-component override beat the locale', () => {
    boot('sv');
    const { container } = render(
      <TenantSelector messages={{ 'tenant.chooseHeading': 'Välj kund' }} />,
    );
    expect(container.textContent).toContain('Välj kund');
    expect(container.textContent).not.toContain(sv['tenant.chooseHeading']);
  });

  it('never renders the raw key, in any locale', () => {
    for (const locale of ['sv', 'de', 'klingon', undefined]) {
      boot(locale);
      const { container } = render(<TenantSelector />);
      expect(container.textContent).not.toContain('tenant.chooseHeading');
      cleanup();
    }
  });
});

describe('TenantSelector select failure (TBP-634)', () => {
  it('shows the Swedish error when selectTenant rejects', async () => {
    boot('sv');
    useBridgeStore.setState({ tenantUsers: [TENANT] } as any);
    // Rejects with no `message`, so the component falls through to the
    // catalogue rather than echoing a server string. An API error that DOES
    // carry a message is still shown verbatim — that is server copy, not ours.
    (getBridgeAuth() as any).selectTenant = mock(() => Promise.reject(new Error('')));

    const { container } = render(<TenantSelector />);
    fireEvent.click(container.querySelector('.bridge-tenant-item')!);

    await waitFor(() => {
      expect(alertText(container)).toContain(sv['tenant.error.select']);
    });
    expect(container.textContent).not.toContain(en['tenant.error.select']);
  });

  it('shows the English error when no locale is set', async () => {
    boot(undefined);
    useBridgeStore.setState({ tenantUsers: [TENANT] } as any);
    (getBridgeAuth() as any).selectTenant = mock(() => Promise.reject(new Error('')));

    const { container } = render(<TenantSelector />);
    fireEvent.click(container.querySelector('.bridge-tenant-item')!);

    await waitFor(() => {
      expect(alertText(container)).toContain(en['tenant.error.select']);
    });
  });
});

// ---------------------------------------------------------------------------
// WorkspaceSelector
// ---------------------------------------------------------------------------

describe('WorkspaceSelector errors (TBP-634)', () => {
  it('shows the Swedish load error when getWorkspaces rejects', async () => {
    boot('sv');
    initBridge({ appId: 'tbp-634' } as any);
    (getBridgeAuth() as any).getWorkspaces = mock(() => Promise.reject(new Error('')));

    const { container } = render(<WorkspaceSelector />);

    await waitFor(() => {
      expect(container.textContent).toContain(sv['workspace.error.load']);
    });
    expect(container.textContent).not.toContain(en['workspace.error.load']);
  });

  it('shows the Swedish switch error when switchWorkspace rejects', async () => {
    boot('sv');
    (getBridgeAuth() as any).getWorkspaces = mock(() => Promise.resolve([WORKSPACE]));
    (getBridgeAuth() as any).switchWorkspace = mock(() => Promise.reject(new Error('')));

    const { container } = render(<WorkspaceSelector />);
    await waitFor(() => {
      expect(container.querySelector('[data-bridge-workspace-item]')).not.toBeNull();
    });
    fireEvent.click(container.querySelector('[data-bridge-workspace-item]')!);

    await waitFor(() => {
      expect(container.textContent).toContain(sv['workspace.error.switch']);
    });
    expect(container.textContent).not.toContain(en['workspace.error.switch']);
  });

  it('shows the English load error when no locale is set', async () => {
    boot(undefined);
    (getBridgeAuth() as any).getWorkspaces = mock(() => Promise.reject(new Error('')));

    const { container } = render(<WorkspaceSelector />);
    await waitFor(() => {
      expect(container.textContent).toContain(en['workspace.error.load']);
    });
  });
});

// ---------------------------------------------------------------------------
// SsoButton
// ---------------------------------------------------------------------------

describe('SsoButton label (TBP-634)', () => {
  it('interpolates the provider name into the localised label', () => {
    boot('sv');
    const { container } = render(<SsoButton connection={CONNECTION} />);
    const text = container.textContent ?? '';
    expect(text).toContain(sv['sso.continueWith'].replace('{provider}', 'Google'));
    expect(text).not.toContain('{provider}');
    expect(text).not.toContain(en['sso.continueWith'].replace('{provider}', 'Google'));
  });

  it('still lets the app supply its own label — that is voice, not mechanics', () => {
    boot('sv');
    const { container } = render(
      <SsoButton connection={CONNECTION} label="Logga in med jobbkontot" />,
    );
    expect(container.textContent).toContain('Logga in med jobbkontot');
    expect(container.textContent).not.toContain(sv['sso.continueWith'].split('{')[0].trim());
  });

  it('falls back to English for an unsupported locale, never to the key', () => {
    boot('klingon');
    const { container } = render(<SsoButton connection={CONNECTION} />);
    expect(container.textContent).toContain(
      en['sso.continueWith'].replace('{provider}', 'Google'),
    );
    expect(container.textContent).not.toContain('sso.continueWith');
  });
});

describe('SsoButton errors (TBP-634)', () => {
  it('reports the pop-up-blocked error in Swedish', async () => {
    boot('sv');
    (getBridgeAuth() as any).startSsoLogin = mock(() =>
      Promise.reject(new Error('popup closed by user')),
    );
    let reported: Error | null = null;

    const { container } = render(
      <SsoButton connection={CONNECTION} onError={(e) => (reported = e)} />,
    );
    fireEvent.click(container.querySelector('button')!);

    await waitFor(() => expect(reported).not.toBeNull());
    expect(reported!.message).toBe(sv['sso.error.popupBlocked']);
  });

  it('reports the generic SSO failure in Swedish', async () => {
    boot('sv');
    (getBridgeAuth() as any).startSsoLogin = mock(() =>
      Promise.resolve({ type: 'auth_error', error: '' }),
    );
    let reported: Error | null = null;

    const { container } = render(
      <SsoButton connection={CONNECTION} onError={(e) => (reported = e)} />,
    );
    fireEvent.click(container.querySelector('button')!);

    await waitFor(() => expect(reported).not.toBeNull());
    expect(reported!.message).toBe(sv['sso.error.login']);
  });

  it('still surfaces a server-supplied message verbatim', async () => {
    // The catalogue is the FALLBACK. A server that explains what went wrong
    // must not have its explanation replaced by a generic translated one.
    boot('sv');
    (getBridgeAuth() as any).startSsoLogin = mock(() =>
      Promise.reject(new Error('Connection is disabled for this tenant')),
    );
    let reported: Error | null = null;

    const { container } = render(
      <SsoButton connection={CONNECTION} onError={(e) => (reported = e)} />,
    );
    fireEvent.click(container.querySelector('button')!);

    await waitFor(() => expect(reported).not.toBeNull());
    expect(reported!.message).toBe('Connection is disabled for this tenant');
  });
});

// ---------------------------------------------------------------------------
// LoginForm fan-out
// ---------------------------------------------------------------------------

describe('LoginForm → TenantSelector fan-out (TBP-634)', () => {
  it('passes messages down, the way it already does to MfaChallenge', () => {
    // The multi-workspace path only renders on this one auth state, which is
    // why it is the fan-out that gets forgotten.
    boot('sv');
    useBridgeStore.setState({
      authState: 'tenant-selection',
      tenantUsers: [TENANT],
    } as any);

    const { container } = render(
      <LoginForm messages={{ 'tenant.chooseHeading': 'Välj kund' }} />,
    );
    expect(container.textContent).toContain('Välj kund');
    expect(container.textContent).not.toContain(sv['tenant.chooseHeading']);
  });
});

/**
 * TBP-631 (description suppression) and TBP-630 (translation), tested against
 * the REAL components rather than a replica of them.
 *
 * TBP-631's bug: `heading={null}` suppressed the heading but not the
 * description, because the description lived in each component's own markup
 * outside AuthFormWrapper's guard. A host page that wrote its own title and
 * subtitle got Bridge's subtitle printed under its own — the same sentence
 * twice, in two voices.
 *
 * The distinction that carries the whole feature is `undefined` vs `null`:
 * `undefined` means "not overridden, use the catalogue", `null` means "the host
 * suppressed this". Collapsing them to `description ?? builtIn` would silently
 * ignore an explicit null, which IS the feature. Every component below is
 * checked on all three: default, overridden, suppressed.
 */
import { afterEach, describe, expect, it } from 'bun:test';
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { MagicLink } from '../src/components/sdk-auth/MagicLink';
import { ForgotPassword } from '../src/components/sdk-auth/ForgotPassword';
import { MfaSetup } from '../src/components/sdk-auth/MfaSetup';
import { PasskeySetup } from '../src/components/sdk-auth/PasskeySetup';
import { PasskeyRequestSetupLink } from '../src/components/sdk-auth/PasskeyRequestSetupLink';
import { SignupForm } from '../src/components/sdk-auth/SignupForm';
import {
  getBridgeAuth,
  initBridge,
  setBridgeConfig,
  _resetBridgeInstance,
} from '../src/core/bridge-instance';
import { en, sv } from '@nebulr-group/bridge-auth-core';

afterEach(() => {
  cleanup();
  _resetBridgeInstance();
  setBridgeConfig(null as any);
});

const desc = (c: HTMLElement) => c.querySelector('.bridge-step-desc');
const heading = (c: HTMLElement) => c.querySelector('.bridge-auth-heading');

describe('description: default / override / suppress', () => {
  const cases = [
    ['MagicLink', <MagicLink />, en['magicLink.description']],
    ['ForgotPassword', <ForgotPassword />, en['forgot.description']],
    ['MfaSetup', <MfaSetup />, en['mfaSetup.phoneDescription']],
    ['PasskeySetup', <PasskeySetup token="t" />, en['passkey.setupClickPrompt']],
    [
      'PasskeyRequestSetupLink',
      <PasskeyRequestSetupLink />,
      en['passkey.requestDescription'],
    ],
  ] as const;

  for (const [name, element, expected] of cases) {
    it(`${name} renders the catalogue description by default`, () => {
      const { container } = render(element);
      expect(desc(container)?.textContent?.trim()).toBe(expected);
    });

    it(`${name} renders a host-supplied description instead`, () => {
      const { container } = render({ ...element, props: { ...element.props, description: 'Mine' } });
      expect(desc(container)?.textContent?.trim()).toBe('Mine');
    });

    it(`${name} renders NO paragraph at all when suppressed with null`, () => {
      const { container } = render({ ...element, props: { ...element.props, description: null } });
      // Not an empty <p> — an empty paragraph still holds vertical space, which
      // is the visible half of the bug.
      expect(desc(container)).toBeNull();
    });
  }

  it('suppressing the description leaves the heading alone', () => {
    const { container } = render(<MagicLink description={null} />);
    expect(desc(container)).toBeNull();
    expect(heading(container)?.textContent?.trim()).toBe(en['magicLink.heading']);
  });

  it('suppressing the heading leaves the description alone', () => {
    // Independent on purpose: an app that writes its own title but not its own
    // subtitle suppresses only the heading.
    const { container } = render(<MagicLink heading={null} />);
    expect(heading(container)).toBeNull();
    expect(desc(container)?.textContent?.trim()).toBe(en['magicLink.description']);
  });
});

describe('descriptions that carry markup are not lifted into the wrapper', () => {
  /** Drive SignupForm into its success state through the real submit path. */
  async function renderSignedUp(props: Record<string, unknown> = {}) {
    _resetBridgeInstance();
    initBridge({ appId: 'test-app' } as any);
    (getBridgeAuth() as any).signup = async () => undefined;

    const utils = render(<SignupForm {...props} />);
    const email = utils.container.querySelector('#signup-email') as HTMLInputElement;
    fireEvent.change(email, { target: { value: 'ada@example.com' } });
    fireEvent.submit(utils.container.querySelector('form')!);
    await waitFor(() =>
      expect(utils.container.querySelector('.bridge-success-heading')).not.toBeNull(),
    );
    return utils;
  }

  it('SignupForm keeps its description BELOW the success heading', async () => {
    const { container } = await renderSignedUp();
    const wrapper = container.querySelector('[data-bridge-auth-form]')!;
    const nodes = Array.from(wrapper.children);

    // The load-bearing assertion: the success heading comes FIRST and the
    // description after it. Lifting this description into AuthFormWrapper — the
    // pattern the other five components use — would print it above the heading
    // it belongs under, because that heading is rendered as a child rather than
    // as the wrapper's own heading.
    const headingIdx = nodes.findIndex((n) => n.className.includes('bridge-success-heading'));
    const descIdx = nodes.findIndex((n) => n.className.includes('bridge-step-desc'));
    expect(headingIdx).toBeGreaterThanOrEqual(0);
    expect(descIdx).toBeGreaterThan(headingIdx);
  });

  it('SignupForm renders the address in <strong>, inside the translated sentence', async () => {
    const { container } = await renderSignedUp();
    const strong = container.querySelector('.bridge-step-desc strong');
    expect(strong?.textContent).toBe('ada@example.com');
    // The whole sentence is translated with the placeholder in it, so a locale
    // may put the address anywhere — nothing here concatenates fragments.
    expect(container.querySelector('.bridge-step-desc')?.textContent).toBe(
      en['signup.successDescription'].replace('{email}', 'ada@example.com'),
    );
  });

  it('SignupForm suppresses its success description with null', async () => {
    const { container } = await renderSignedUp({ description: null });
    expect(container.querySelector('.bridge-step-desc')).toBeNull();
    // …without taking the success heading with it.
    expect(container.querySelector('.bridge-success-heading')).not.toBeNull();
  });

  it('PasskeySetup keeps the button as the only body content pre-click', () => {
    const { container } = render(<PasskeySetup token="t" />);
    const wrapper = container.querySelector('[data-bridge-auth-form]')!;
    const children = Array.from(wrapper.children);
    // description sits directly under the wrapper (lifted), button after it.
    expect(children[0].className).toContain('bridge-auth-heading');
    expect(children[1].className).toContain('bridge-step-desc');
    expect(children[2].tagName).toBe('BUTTON');
  });
});

describe('locale resolution', () => {
  it('renders Swedish when config asks for it', () => {
    setBridgeConfig({ appId: 'x', locale: 'sv' } as any);
    const { container } = render(<MagicLink />);
    expect(desc(container)?.textContent?.trim()).toBe(sv['magicLink.description']);
  });

  it('resolves a region variant to its base language', () => {
    // sv-SE falling back to English is the bug, not the behaviour.
    setBridgeConfig({ appId: 'x', locale: 'sv-SE' } as any);
    const { container } = render(<MagicLink />);
    expect(desc(container)?.textContent?.trim()).toBe(sv['magicLink.description']);
  });

  it('falls back to English for an unknown locale rather than throwing', () => {
    setBridgeConfig({ appId: 'x', locale: 'klingon' } as any);
    const { container } = render(<MagicLink />);
    expect(desc(container)?.textContent?.trim()).toBe(en['magicLink.description']);
  });

  it('renders English when nothing is configured — not a breaking change', () => {
    const { container } = render(<MagicLink />);
    expect(heading(container)?.textContent?.trim()).toBe(en['magicLink.heading']);
  });

  it('lets a per-component messages prop beat the locale', () => {
    setBridgeConfig({ appId: 'x', locale: 'sv' } as any);
    const { container } = render(
      <MagicLink messages={{ 'magicLink.heading': 'Just this screen' }} />,
    );
    expect(heading(container)?.textContent?.trim()).toBe('Just this screen');
    // …and leaves every other key on the configured locale.
    expect(desc(container)?.textContent?.trim()).toBe(sv['magicLink.description']);
  });

  it('lets config messages override the locale, and the prop override config', () => {
    setBridgeConfig({
      appId: 'x',
      locale: 'sv',
      messages: { 'magicLink.heading': 'From config' },
    } as any);
    const { container: a } = render(<MagicLink />);
    expect(heading(a)?.textContent?.trim()).toBe('From config');

    const { container: b } = render(
      <MagicLink messages={{ 'magicLink.heading': 'From prop' }} />,
    );
    expect(heading(b)?.textContent?.trim()).toBe('From prop');
  });

  it('never renders a raw key', () => {
    // If the catalogue is wrong the user sees the wrong language, which is a
    // defect. If it rendered keys they would see `magicLink.heading` on screen,
    // which is a broken product.
    setBridgeConfig({ appId: 'x', locale: 'sv' } as any);
    const { container } = render(<MagicLink />);
    expect(container.textContent).not.toContain('magicLink.');
  });
});

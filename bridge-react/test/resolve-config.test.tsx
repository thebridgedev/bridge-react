/**
 * TBP-743 — one bootstrap reading `VITE_BRIDGE_*`, explicit options winning.
 *
 * Before: <BridgeProvider> merged the environment ON TOP of its props, so an
 * explicit `appId` / `apiBaseUrl` lost to `.env`, and the hosted pages never
 * followed a stage API address. Revert-proof: on origin/main the provider test
 * below resolves the environment's app id, and `resolve-config` does not exist.
 */
import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import { hostedUrlFor, readBridgeEnv, resolveBridgeConfig } from '../src/core/resolve-config';
import { BridgeProvider } from '../src/providers/bridge-provider';
import { _resetBridgeInstance, getBridgeAuth, getBridgeConfig } from '../src/core/bridge-instance';
import { __resetBridgeRuntime } from '../src/core/bridge-runtime';

const ENV_KEYS = [
  'VITE_BRIDGE_APP_ID',
  'VITE_BRIDGE_API_BASE_URL',
  'VITE_BRIDGE_HOSTED_URL',
  'VITE_BRIDGE_DEBUG',
  'REACT_APP_BRIDGE_APP_ID',
];
let saved: Record<string, string | undefined>;
let warn: ReturnType<typeof spyOn>;
let originalFetch: typeof fetch;

beforeEach(() => {
  // The provider tests start the runtime; nothing may reach a real network.
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('offline (unit test)');
  }) as unknown as typeof fetch;
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  warn = spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  warn.mockRestore();
  globalThis.fetch = originalFetch;
  __resetBridgeRuntime();
  _resetBridgeInstance();
});

describe('precedence: explicit option > environment > default', () => {
  it('reads every field from the environment when nothing is passed', () => {
    const c = resolveBridgeConfig({}, { appId: 'env-app', apiBaseUrl: 'https://api-stage.thebridge.dev', debug: 'true' }, false);
    expect(c.appId).toBe('env-app');
    expect(c.apiBaseUrl).toBe('https://api-stage.thebridge.dev');
    expect(c.debug).toBe(true);
  });

  it('an explicit option wins over the environment, field by field', () => {
    const c = resolveBridgeConfig(
      { appId: 'explicit-app', debug: false },
      { appId: 'env-app', apiBaseUrl: 'https://api-stage.thebridge.dev', debug: 'true' },
      false,
    );
    expect(c.appId).toBe('explicit-app');
    expect(c.debug).toBe(false);
    // Not passed explicitly: the environment still fills it.
    expect(c.apiBaseUrl).toBe('https://api-stage.thebridge.dev');
  });

  it('treats an empty variable as not set', () => {
    const c = resolveBridgeConfig({ appId: '' }, { appId: 'env-app', apiBaseUrl: '   ' }, false);
    expect(c.appId).toBe('env-app');
    expect(c.apiBaseUrl).toBeUndefined();
  });

  it('carries non-environment options through untouched', () => {
    const c = resolveBridgeConfig({ appId: 'a', billing: { manageRoute: '/plans' }, locale: 'sv' }, {}, false);
    expect(c.billing).toEqual({ manageRoute: '/plans' });
    expect(c.locale).toBe('sv');
  });
});

describe('no guessing', () => {
  it('throws, naming VITE_BRIDGE_APP_ID, when no app id is resolved', () => {
    expect(() => resolveBridgeConfig({}, {}, false)).toThrow(/VITE_BRIDGE_APP_ID/);
  });

  it('in a development build, says production is being used and names VITE_BRIDGE_API_BASE_URL', () => {
    resolveBridgeConfig({ appId: 'a' }, {}, true);
    expect(warn.mock.calls.map((c) => String(c[0])).join('\n')).toContain('VITE_BRIDGE_API_BASE_URL');
  });

  it('stays silent in a production build', () => {
    resolveBridgeConfig({ appId: 'a' }, {}, false);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('the hosted pages follow the API address', () => {
  it('a stage API address alone sends sign-in to stage, not production', () => {
    const c = resolveBridgeConfig({ appId: 'a', apiBaseUrl: 'https://api-stage.thebridge.dev' }, {}, false);
    expect(c.hostedUrl).toBe('https://auth-stage.thebridge.dev');
  });

  it('an explicit or environment hosted address still wins', () => {
    expect(
      resolveBridgeConfig({ appId: 'a', apiBaseUrl: 'https://api-stage.thebridge.dev', hostedUrl: 'https://x.test' }, {}, false)
        .hostedUrl,
    ).toBe('https://x.test');
    expect(
      resolveBridgeConfig({ appId: 'a' }, { apiBaseUrl: 'https://api-stage.thebridge.dev', hostedUrl: 'https://y.test' }, false)
        .hostedUrl,
    ).toBe('https://y.test');
  });

  it('maps only Bridge API hosts', () => {
    expect(hostedUrlFor('https://api.thebridge.dev')).toBe('https://auth.thebridge.dev');
    expect(hostedUrlFor('http://localhost:3300')).toBeUndefined();
    expect(hostedUrlFor('https://api.example.com')).toBeUndefined();
  });
});

describe('the build variables', () => {
  it('reads VITE_BRIDGE_* first, then REACT_APP_BRIDGE_*', () => {
    process.env.REACT_APP_BRIDGE_APP_ID = 'cra-app';
    expect(readBridgeEnv().appId).toBe('cra-app');
    process.env.VITE_BRIDGE_APP_ID = 'vite-app';
    expect(readBridgeEnv().appId).toBe('vite-app');
  });
});

describe('<BridgeProvider> applies it', () => {
  it('an explicit appId wins over VITE_BRIDGE_APP_ID', () => {
    process.env.VITE_BRIDGE_APP_ID = 'env-app';
    render(
      <BridgeProvider config={{ appId: 'explicit-app', apiBaseUrl: 'http://127.0.0.1:1' }}>
        <div />
      </BridgeProvider>,
    );
    expect(getBridgeConfig()?.appId).toBe('explicit-app');
    expect(getBridgeAuth().getApiContext().appId).toBe('explicit-app');
  });

  it('with no props at all it starts from VITE_BRIDGE_APP_ID, and a stage address reaches the hosted pages', () => {
    process.env.VITE_BRIDGE_APP_ID = 'env-app';
    process.env.VITE_BRIDGE_API_BASE_URL = 'https://api-stage.thebridge.dev';
    render(
      <BridgeProvider>
        <div />
      </BridgeProvider>,
    );
    expect(getBridgeConfig()?.appId).toBe('env-app');
    expect(getBridgeConfig()?.hostedUrl).toBe('https://auth-stage.thebridge.dev');
  });

  it('with no app id anywhere it refuses to start and names the variable', () => {
    const error = spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { container } = render(
        <BridgeProvider>
          <div>public page</div>
        </BridgeProvider>,
      );
      expect(container.textContent).toContain('public page');
      expect(getBridgeConfig()).toBeNull();
      expect(error.mock.calls.map((c) => String(c[0])).join('\n')).toContain('VITE_BRIDGE_APP_ID');
    } finally {
      error.mockRestore();
    }
  });
});

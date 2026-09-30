/**
 * TBP-743 — the `--bridge-*` token contract applies to every component, and
 * neither router is a hard dependency.
 *
 * Token contract (bridge-svelte's `learning/mechanisms.md` §6): the defaults
 * are declared on `:where(:root)` (zero specificity, so the app's `:root`
 * wins), every documented token exists, and no rule paints a colour except
 * through a token — a literal colour is allowed only as the fallback inside
 * `var(--bridge-…, …)` or in a shadow. Revert-proof: on origin/main the
 * defaults sit on a plain `:root` (they beat nothing and lose to load order),
 * half the documented tokens are missing, and the billing notice, quota banner,
 * subscription badge and paywall paint hard-coded colours.
 */
import { describe, expect, it } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const root = path.resolve(import.meta.dir, '..');
const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
const code = css.replace(/\/\*[\s\S]*?\*\//g, '');

/** The token table in bridge-svelte's mechanisms.md, §6. */
const DOCUMENTED = [
  '--bridge-primary',
  '--bridge-primary-hover',
  '--bridge-primary-fg',
  '--bridge-primary-light',
  '--bridge-input-focus',
  '--bridge-bg',
  '--bridge-foreground',
  '--bridge-muted',
  '--bridge-muted-bg',
  '--bridge-border',
  '--bridge-border-radius',
  '--bridge-overlay',
  ...['error', 'success', 'info', 'warning'].flatMap((v) =>
    ['bg', 'fg', 'border'].map((p) => `--bridge-alert-${v}-${p}`),
  ),
  '--bridge-auth-page-padding',
  '--bridge-billing-page-width',
  '--bridge-billing-page-padding',
  '--bridge-paywall-bg',
  '--bridge-paywall-panel-bg',
];

describe('the --bridge-* token contract', () => {
  it('declares its defaults on :where(:root), never on a plain :root', () => {
    expect(code).toMatch(/:where\(:root\)\s*\{[^}]*--bridge-primary:/);
    expect(code).not.toMatch(/(^|[^(]):root\s*\{/m);
  });

  it('every documented token is part of the stylesheet', () => {
    const missing = DOCUMENTED.filter((t) => !code.includes(t));
    expect(missing).toEqual([]);
  });

  it('no rule paints a literal colour except as a token fallback or a shadow', () => {
    const offenders: string[] = [];
    for (const raw of code.split('\n')) {
      const line = raw.trim();
      if (!/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(line)) continue;
      if (line.startsWith('--bridge-') || line.includes('box-shadow')) continue;
      let stripped = line;
      let previous = '';
      while (previous !== stripped) {
        previous = stripped;
        stripped = stripped.replace(/var\(--bridge-[a-z0-9-]+(,[^()]*(\([^()]*\))?[^()]*)?\)/g, 'VAR');
      }
      if (/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(stripped)) offenders.push(line);
    }
    expect(offenders).toEqual([]);
  });

  it('styles the components added for the ten-line integration', () => {
    for (const selector of [
      '.bridge-auth-page',
      '.bridge-billing-page',
      '.bridge-paywall-page',
      '.bridge-upgrade-dialog',
      '.bridge-plan-interval-tabs',
      '.bridge-plan-features',
      '.bridge-plan-confirm',
    ]) {
      // The upgrade dialog is styled as a team dialog (it carries both classes).
      const target = selector === '.bridge-upgrade-dialog' ? '.bridge-team-dialog' : selector;
      expect(code.includes(target)).toBe(true);
    }
  });
});

describe('router adapters are optional', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

  it('both routers are optional peers with their own subpath entries', () => {
    for (const name of ['react-router', '@tanstack/react-router']) {
      expect(pkg.peerDependencies[name]).toBeDefined();
      expect(pkg.peerDependenciesMeta?.[name]?.optional).toBe(true);
      expect(pkg.dependencies?.[name]).toBeUndefined();
    }
    expect(pkg.exports['./react-router']).toBeDefined();
    expect(pkg.exports['./tanstack-router']).toBeDefined();
  });

  it('only the adapter entries import a router', () => {
    const importers: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name)) {
          const src = fs.readFileSync(full, 'utf8');
          if (/^import[^;]*from ['"](react-router|react-router-dom|@tanstack\/react-router)['"]/m.test(src)) {
            importers.push(path.relative(path.join(root, 'src'), full));
          }
        }
      }
    };
    walk(path.join(root, 'src'));
    expect(importers.sort()).toEqual(['react-router/index.tsx', 'tanstack-router/index.tsx']);
  });
});

/**
 * TBP-945 (port of bridge-svelte TBP-814's styles.test.ts) — the default
 * stylesheet follows the app's type and loses to the app's CSS.
 *
 * Static checks on `styles.css`:
 *   - the layer order statement comes first, `bridge` last after Tailwind v4's layers;
 *   - `--bridge-text-base` is registered with `@property`, outside any layer;
 *   - every rule after that sits inside one `@layer bridge` block, including the
 *     component styles bridge-svelte keeps inside its components;
 *   - no text size is a fixed `rem` any more, and no weight is hard-coded except
 *     the two avatar initials;
 *   - the token fallbacks are the values the rules had before, so an app that
 *     sets nothing sees no change.
 *
 * bridge-svelte parses with svelte's CSS parser; this repo has none, so a small
 * parser below reads the same tree (rules, at-rules, declarations).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'bun:test';

const source = readFileSync(join(import.meta.dir, '../src/styles.css'), 'utf8');

type Decl = { type: 'decl'; property: string; value: string };
type Rule = { type: 'rule'; selector: string; children: Node[] };
type AtRule = { type: 'atrule'; name: string; prelude: string; children: Node[] | null };
type Node = Decl | Rule | AtRule;

/** Parse CSS into rules, at-rules and declarations. Enough for this stylesheet: no strings hold braces. */
function parse(css: string): Node[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let i = 0;
  function block(): Node[] {
    const out: Node[] = [];
    while (i < text.length) {
      while (i < text.length && /\s/.test(text[i])) i++;
      if (i >= text.length || text[i] === '}') {
        i++;
        return out;
      }
      // Read up to the first of `{`, `;` or `}` to tell what this is.
      let j = i;
      while (j < text.length && text[j] !== '{' && text[j] !== ';' && text[j] !== '}') j++;
      const head = text.slice(i, j).trim();
      if (text[j] === '{') {
        i = j + 1;
        const children = block();
        if (head.startsWith('@')) {
          const m = head.match(/^@([\w-]+)\s*([\s\S]*)$/)!;
          out.push({ type: 'atrule', name: m[1], prelude: m[2].trim(), children });
        } else {
          out.push({ type: 'rule', selector: head.replace(/\s+/g, ' '), children });
        }
      } else {
        i = text[j] === ';' ? j + 1 : j;
        if (head.startsWith('@')) {
          const m = head.match(/^@([\w-]+)\s*([\s\S]*)$/)!;
          out.push({ type: 'atrule', name: m[1], prelude: m[2].trim(), children: null });
        } else if (head) {
          const colon = head.indexOf(':');
          out.push({ type: 'decl', property: head.slice(0, colon).trim(), value: head.slice(colon + 1).trim() });
        }
      }
    }
    return out;
  }
  return block();
}

const sheet = parse(source);

type Found = { selector: string; property: string; value: string };
function declarations(nodes: Node[], selector = '', out: Found[] = []): Found[] {
  for (const node of nodes) {
    if (node.type === 'decl') out.push({ selector, property: node.property, value: node.value });
    else if (node.type === 'rule') declarations(node.children, node.selector, out);
    else if (node.children) declarations(node.children, selector, out);
  }
  return out;
}

const all = declarations(sheet).filter((d) => d.selector !== '');
const valueOf = (selector: string, property: string) =>
  all.find((d) => d.selector.split(',').map((s) => s.trim()).includes(selector) && d.property === property)?.value;
const selectors = new Set(all.flatMap((d) => d.selector.split(',').map((s) => s.trim())));

describe('styles.css — cascade layer (TBP-945 / TBP-814)', () => {
  it('opens with the layer order statement, bridge after Tailwind v4’s layers', () => {
    const first = sheet[0];
    expect(first.type === 'atrule' && first.name).toBe('layer');
    if (first.type !== 'atrule') return;
    expect(first.children).toBeNull();
    expect(first.prelude.split(',').map((s) => s.trim())).toEqual(['theme', 'base', 'components', 'utilities', 'bridge']);
  });

  it('registers --bridge-text-base with @property, outside the layer', () => {
    const second = sheet[1];
    expect(second.type === 'atrule' && second.name).toBe('property');
    if (second.type !== 'atrule' || !second.children) return;
    expect(second.prelude).toBe('--bridge-text-base');
    const descriptors = Object.fromEntries(
      second.children.map((c) => (c.type === 'decl' ? [c.property, c.value] : ['', ''])),
    );
    expect(descriptors).toMatchObject({ syntax: "'<length>'", inherits: 'true', 'initial-value': '16px' });
  });

  it('puts everything after the @property inside a single @layer bridge block', () => {
    expect(sheet).toHaveLength(3);
    const layer = sheet[2];
    expect(layer.type === 'atrule' && `${layer.name} ${layer.prelude}`).toBe('layer bridge');
    if (layer.type !== 'atrule') return;
    expect(layer.children!.length).toBeGreaterThan(100);
    expect(sheet.filter((n) => n.type === 'rule')).toHaveLength(0);
  });

  it('holds the component styles bridge-svelte scopes in its components, in the same layer', () => {
    for (const s of [
      '.bridge-subscription-status',
      '.bss-badge',
      '.bridge-paywall-panel',
      '.bqb-cta',
      '.bbn-cta',
      '.bbl-cta',
      '.bridge-auth-page',
      '.bridge-billing-page',
      '.bridge-billing-summary-plan',
      '.bridge-paywall-page-heading',
    ]) {
      expect(selectors.has(s), s).toBe(true);
    }
  });

  it('derives the base text size from the app’s <body>', () => {
    expect(valueOf(':where(body)', '--bridge-text-base')).toBe('var(--bridge-font-size, 1em)');
  });
});

describe('styles.css — type follows the app (TBP-945 / TBP-814)', () => {
  it('has no fixed rem font sizes left', () => {
    const fixed = all.filter((d) => d.property === 'font-size' && /^[\d.]+rem$/.test(d.value));
    expect(fixed).toEqual([]);
  });

  it('scales every relative font size from --bridge-text-base with a 1rem fallback', () => {
    const sizes = all.filter((d) => d.property === 'font-size' && d.value !== 'inherit');
    expect(sizes.length).toBeGreaterThan(50);
    for (const d of sizes) {
      expect(d.value, d.selector).toMatch(/^calc\([\d.]+ \* var\(--bridge-text-base, 1rem\)\)$/);
    }
  });

  it('hard-codes no font-weight except the two avatar initials and inherited link weight', () => {
    const literal = all.filter((d) => d.property === 'font-weight' && !d.value.startsWith('var(') && d.value !== 'inherit');
    expect(literal.map((d) => d.selector).sort()).toEqual(['.bridge-tenant-avatar', '[data-bridge-workspace-avatar]']);
    for (const d of all.filter((d) => d.property === 'font-weight' && d.value.startsWith('var('))) {
      expect(d.value, d.selector).toMatch(/^var\(--bridge-font-weight-(heading|button|label), \d{3}\)$/);
    }
  });

  it('keeps the previous values as the token fallbacks', () => {
    // Pre-TBP-814: `.bridge-btn { font-size: 0.875rem; font-weight: 500 }`.
    expect(valueOf('.bridge-btn', 'font-size')).toBe('calc(0.875 * var(--bridge-text-base, 1rem))');
    expect(valueOf('.bridge-btn', 'font-weight')).toBe('var(--bridge-font-weight-button, 500)');
    expect(valueOf('.bridge-plan-price-amount', 'font-size')).toBe('calc(1.9 * var(--bridge-text-base, 1rem))');
    expect(valueOf('.bridge-plan-price-amount', 'font-weight')).toBe('var(--bridge-font-weight-heading, 700)');
    // React's component section: `.bridge-billing-heading { font-size: 1.5rem; font-weight: 700 }` before.
    expect(valueOf('.bridge-billing-heading', 'font-size')).toBe('calc(1.5 * var(--bridge-text-base, 1rem))');
    expect(valueOf('.bridge-billing-heading', 'font-weight')).toBe('var(--bridge-font-weight-heading, 700)');
    expect(valueOf('.bss-badge', 'font-size')).toBe('calc(0.75 * var(--bridge-text-base, 1rem))');
  });

  it('gives every button a shadow token that defaults to none', () => {
    for (const selector of ['.bridge-btn', '.bridge-btn-primary', '.bridge-btn-secondary', '.bridge-btn-danger']) {
      expect(valueOf(selector, 'box-shadow'), selector).toBe('var(--bridge-button-shadow, none)');
    }
  });

  it('lets --bridge-card-shadow style the plan cards and the plan-change dialog, defaulting to the old shadows', () => {
    expect(valueOf('.bridge-plan-confirm', 'box-shadow')).toBe(
      'var(--bridge-card-shadow, 0 24px 60px -12px rgba(0, 0, 0, 0.35))',
    );
    expect(valueOf('[data-bridge-plan-card]', 'box-shadow')).toStartWith('var(--bridge-card-shadow,');
    expect(valueOf('[data-bridge-plan-card]', 'background')).toBe('var(--bridge-card-bg, var(--bridge-bg))');
  });

  it('keeps the TBP-899 sign-in link and method-button fixes', () => {
    expect(valueOf('a.bridge-btn', 'text-decoration')).toBe('none');
    expect(valueOf('.bridge-sso-btn-inner > :not(:last-child)', 'flex-shrink')).toBe('0');
  });
});

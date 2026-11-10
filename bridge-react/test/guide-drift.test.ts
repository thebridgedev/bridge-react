/**
 * Guide drift — the guides this repo serves to AI agents (`mcp/`, `learning/`,
 * the READMEs; the Bridge MCP server reads them from GitHub main) must only
 * name things the package really has. An agent copies what a guide says: an
 * import of an export that was renamed, a component that never shipped, or a
 * prop or config option that does not exist turns into a build error or, worse,
 * a silent no-op in the developer's app.
 *
 * What is checked, against the package's own TypeScript (no build needed):
 *   1. every named import from `@nebulr-group/bridge-react` or one of its
 *      entries (`/flags`, `/react-router`, `/tanstack-router`) is exported by
 *      that entry;
 *   2. every JSX tag in a code block or inline code is a component the package
 *      exports, a tag the guide defines itself, or one of the app/third-party
 *      names listed in NOT_OURS below;
 *   3. every prop written on one of the package's components is a prop it
 *      takes;
 *   4. every `useXxx` hook named in code is exported (or is React's or a
 *      router's, listed in NOT_OURS_HOOKS);
 *   5. every `billing.<option>` and every key of a `billing: { … }` literal is
 *      an option of `BridgeConfig['billing']`;
 *   6. every `bridge.<a>.<b>` path exists on the exported `bridge` object.
 *
 * Adding a new example component to a guide? Define it in the guide
 * (`function MyThing()`), or add its name to NOT_OURS.
 */
import { describe, expect, it } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';

const PKG = resolve(import.meta.dir, '..');
const REPO = resolve(PKG, '..');

// ── The package's public surface, read from its TypeScript ──────────────────

const ENTRIES: Record<string, string> = {
  '@nebulr-group/bridge-react': join(PKG, 'src/index.ts'),
  '@nebulr-group/bridge-react/flags': join(PKG, 'src/flags/index.ts'),
  '@nebulr-group/bridge-react/react-router': join(PKG, 'src/react-router/index.tsx'),
  '@nebulr-group/bridge-react/tanstack-router': join(PKG, 'src/tanstack-router/index.tsx'),
};

const program = ts.createProgram(Object.values(ENTRIES), {
  target: ts.ScriptTarget.ES2020,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Node10,
  jsx: ts.JsxEmit.ReactJSX,
  esModuleInterop: true,
  skipLibCheck: true,
  strict: true,
  noEmit: true,
});
const checker = program.getTypeChecker();

function exportsOf(file: string): Map<string, ts.Symbol> {
  const source = program.getSourceFile(file);
  const moduleSymbol = source && checker.getSymbolAtLocation(source);
  if (!moduleSymbol) throw new Error(`cannot read the exports of ${file}`);
  return new Map(checker.getExportsOfModule(moduleSymbol).map((s) => [s.getName(), s]));
}

const entryExports = new Map(Object.entries(ENTRIES).map(([spec, file]) => [spec, exportsOf(file)]));
const allExports = new Map<string, ts.Symbol>();
for (const exports of entryExports.values()) for (const [name, sym] of exports) if (!allExports.has(name)) allExports.set(name, sym);

function resolved(sym: ts.Symbol): ts.Symbol {
  return sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym;
}

function valueType(sym: ts.Symbol): ts.Type | null {
  const target = resolved(sym);
  const decl = target.valueDeclaration ?? target.declarations?.[0];
  if (!decl) return null;
  return checker.getTypeOfSymbolAtLocation(target, decl);
}

/** The props a component takes, or null when its props cannot be read (any, index signature). */
const propsCache = new Map<string, Set<string> | null>();
function propsOf(component: string): Set<string> | null {
  if (propsCache.has(component)) return propsCache.get(component)!;
  let out: Set<string> | null = null;
  const sym = allExports.get(component);
  const type = sym && valueType(sym);
  const signature = type?.getCallSignatures()[0];
  const param = signature?.getParameters()[0];
  if (param && signature) {
    const decl = param.valueDeclaration ?? param.declarations?.[0];
    const propsType = decl ? checker.getTypeOfSymbolAtLocation(param, decl) : null;
    if (propsType && !(propsType.flags & ts.TypeFlags.Any) && !propsType.getStringIndexType()) {
      out = new Set(checker.getPropertiesOfType(checker.getApparentType(propsType)).map((p) => p.getName()));
    }
  } else if (signature) {
    out = new Set(); // takes no props
  }
  propsCache.set(component, out);
  return out;
}

function propertiesOf(type: ts.Type): Map<string, ts.Symbol> {
  const nonNull = checker.getNonNullableType(type);
  return new Map(checker.getPropertiesOfType(checker.getApparentType(nonNull)).map((p) => [p.getName(), p]));
}

function typeOfProperty(sym: ts.Symbol): ts.Type {
  const decl = sym.valueDeclaration ?? sym.declarations?.[0];
  return decl ? checker.getTypeOfSymbolAtLocation(sym, decl) : checker.getTypeOfSymbol(sym);
}

const billingOptions = (() => {
  const config = resolved(exportsOf(join(PKG, 'src/types/config.ts')).get('BridgeConfig')!);
  const billing = propertiesOf(checker.getDeclaredTypeOfSymbol(config)).get('billing');
  if (!billing) throw new Error('BridgeConfig has no billing option');
  return new Set(propertiesOf(typeOfProperty(billing)).keys());
})();

/** The value a store holds (`T` of `subscribe(run: (value: T) => void)`), or null. */
function storeValueType(type: ts.Type): ts.Type | null {
  const subscribe = propertiesOf(type).get('subscribe');
  const run = subscribe && typeOfProperty(subscribe).getCallSignatures()[0]?.getParameters()[0];
  const runType = run && typeOfProperty(run);
  const value = runType?.getCallSignatures()[0]?.getParameters()[0];
  return value ? typeOfProperty(value) : null;
}

/**
 * True when `bridge.<path>` exists on the exported `bridge` object. A store
 * segment may be followed by a field of the value it holds (`bridge.user.role`).
 */
function bridgePathExists(path: string[]): boolean {
  let type = valueType(allExports.get('bridge')!);
  for (const segment of path) {
    if (!type) return false;
    let prop = propertiesOf(type).get(segment);
    if (!prop) {
      const held = storeValueType(type);
      prop = held ? propertiesOf(held).get(segment) : undefined;
    }
    if (!prop) return false;
    type = typeOfProperty(prop);
  }
  return true;
}

// ── Names that are not the package's ─────────────────────────────────────────

/** JSX tags that belong to the app (example components) or to another library. */
const NOT_OURS = new Set([
  // React, routers, docs-site components
  'StrictMode', 'App', 'Routes', 'Route', 'BrowserRouter', 'Navigate', 'Link', 'Outlet', 'Tabs', 'TabItem',
  // the app's own components in the examples
  'MyLoginPage', 'MyLogin', 'MyPricing', 'MySubscriptionPage', 'DashboardPage', 'HomePage', 'Home', 'LoginPage',
  'SignupPage', 'ForgotPasswordPage', 'MagicLinkPage', 'AdminPanel', 'Reports', 'NewDashboard', 'OldLanding',
  'NewLanding', 'AnalyticsPanel', 'AiPanel', 'PremiumArea', 'BetaArea', 'BetaReportsPanel', 'ExportButton',
  'FlagsDemo', 'Spinner',
]);

/** Hooks that belong to React or a router. */
const NOT_OURS_HOOKS = new Set([
  'useState', 'useEffect', 'useMemo', 'useCallback', 'useRef', 'useContext', 'useReducer', 'useLayoutEffect',
  'useSyncExternalStore', 'useId', 'useTransition', 'useNavigate', 'useLocation', 'useParams', 'useSearchParams',
  'useRouter', 'useRouterState', 'useMatch',
]);

/** `bridge.…` strings that are not paths on the `bridge` object. */
const NOT_OURS_PATHS = new Set([
  'bridge.anon_id', // the browser-storage key of the anonymous id
]);

// ── Reading a guide ──────────────────────────────────────────────────────────

export type Drift = { line: number; what: string };

/** The code in a guide — fenced blocks and inline `code` — with its line numbers. */
function codeOf(markdown: string): Array<{ line: number; code: string }> {
  const out: Array<{ line: number; code: string }> = [];
  let fence: string[] | null = null;
  let fenceStart = 0;
  markdown.split('\n').forEach((text, i) => {
    if (/^\s*(?:```|~~~)/.test(text)) {
      if (fence) {
        out.push({ line: fenceStart, code: fence.join('\n') });
        fence = null;
      } else {
        fence = [];
        fenceStart = i + 2;
      }
      return;
    }
    if (fence) {
      fence.push(text);
      return;
    }
    for (const m of text.matchAll(/`([^`]+)`/g)) out.push({ line: i + 1, code: m[1] });
  });
  return out;
}

/** Line number of `offset` inside a code chunk that starts at `start`. */
function lineAt(start: number, code: string, offset: number): number {
  return start + (code.slice(0, offset).match(/\n/g)?.length ?? 0);
}

/** Attribute names on the JSX tag that starts at `from` (just after its name). */
function attributesAt(code: string, from: number): string[] {
  const names: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  for (let i = from; i < code.length; i++) {
    const c = code[i];
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || (c === '`' && depth > 0)) {
      quote = c;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (depth === 0 && (c === '>' || (c === '/' && code[i + 1] === '>'))) break;
    else if (depth === 0 && /[A-Za-z]/.test(c) && /[\s]/.test(code[i - 1] ?? '')) {
      const m = /^[A-Za-z][\w-]*/.exec(code.slice(i))!;
      names.push(m[0]);
      i += m[0].length - 1;
    }
  }
  return names;
}

export function guideDrift(markdown: string): Drift[] {
  const out: Drift[] = [];
  const defined = new Set([...markdown.matchAll(/\b(?:function|const|class|let|var)\s+([A-Za-z_]\w*)/g)].map((m) => m[1]));
  // Names a guide imports from somewhere else are that library's, not ours.
  const importedElsewhere = new Set<string>();
  for (const m of markdown.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/g)) {
    if (m[2].startsWith('@nebulr-group/bridge-react')) continue;
    for (const part of m[1].split(',')) {
      const local = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()?.trim();
      if (local) importedElsewhere.add(local);
    }
  }

  for (const { line, code } of codeOf(markdown)) {
    // 1. imports from the package
    for (const m of code.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"](@nebulr-group\/bridge-react[^'"]*)['"]/g)) {
      const exports = entryExports.get(m[2]);
      const at = lineAt(line, code, m.index!);
      if (!exports) {
        out.push({ line: at, what: `import from '${m[2]}', which is not an entry of the package` });
        continue;
      }
      for (const part of m[1].split(',')) {
        const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]?.trim();
        if (name && !exports.has(name)) out.push({ line: at, what: `'${name}' is not exported by '${m[2]}'` });
      }
    }

    // 2 + 3. JSX tags and their props (not type arguments such as `Readable<UserSnapshot>`)
    for (const m of code.matchAll(/(^|[^\w.])<([A-Z][A-Za-z0-9]*)(?=[\s/>])/g)) {
      const tag = m[2];
      const at = lineAt(line, code, m.index!);
      if (NOT_OURS.has(tag) || defined.has(tag) || importedElsewhere.has(tag)) continue;
      if (!allExports.has(tag)) {
        out.push({ line: at, what: `<${tag}> is not a component the package exports` });
        continue;
      }
      const props = propsOf(tag);
      if (!props) continue;
      for (const attr of attributesAt(code, m.index! + m[0].length)) {
        if (attr === 'key' || attr === 'ref' || attr === 'children') continue;
        if (!props.has(attr)) out.push({ line: at, what: `<${tag}> has no prop '${attr}'` });
      }
    }

    // 4. hooks
    for (const m of code.matchAll(/(?<![\w.$])(use[A-Z]\w*)\b/g)) {
      const hook = m[1];
      if (NOT_OURS_HOOKS.has(hook) || defined.has(hook) || importedElsewhere.has(hook) || allExports.has(hook)) continue;
      if (/^\s*:/.test(code.slice(m.index! + hook.length))) continue; // an object key (`useClass: …`), not a call
      out.push({ line: lineAt(line, code, m.index!), what: `${hook}() is not exported by the package` });
    }

    // 5. billing options
    for (const m of code.matchAll(/(?<![\w.$:-])billing\.([A-Za-z]\w*)/g)) {
      if (!billingOptions.has(m[1])) out.push({ line: lineAt(line, code, m.index!), what: `billing.${m[1]} is not a config option` });
    }
    for (const m of code.matchAll(/\bbilling\s*:\s*\{([^{}]*)\}/g)) {
      for (const k of m[1].matchAll(/(?:^|,)\s*([A-Za-z]\w*)\s*:/g)) {
        if (!billingOptions.has(k[1])) out.push({ line: lineAt(line, code, m.index!), what: `billing.${k[1]} is not a config option` });
      }
    }

    // 6. bridge.* paths
    for (const m of code.matchAll(/(?<![\w.$@/-])bridge((?:\.[A-Za-z_]\w*)+)/g)) {
      const path = m[1].slice(1).split('.');
      if (NOT_OURS_PATHS.has(`bridge.${path.join('.')}`)) continue;
      if (!bridgePathExists(path)) out.push({ line: lineAt(line, code, m.index!), what: `bridge.${path.join('.')} does not exist` });
    }
  }
  return out;
}

// ── This repo's agent-facing guides ─────────────────────────────────────────

function markdownFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return markdownFiles(path);
    return name.endsWith('.md') ? [path] : [];
  });
}

const guides = [
  ...markdownFiles(join(REPO, 'mcp')),
  ...markdownFiles(join(REPO, 'learning')),
  join(REPO, 'README.md'),
  join(PKG, 'README.md'),
];

describe('guide drift: every export, component, prop and option a guide names exists', () => {
  it('reads the package surface and finds the guides (guards against checking nothing)', () => {
    expect(entryExports.get('@nebulr-group/bridge-react')!.has('BridgeProvider')).toBe(true);
    expect(propsOf('TeamManagementPanel')?.has('seatsMetric')).toBe(true);
    expect(billingOptions.has('successRoute')).toBe(true);
    expect(bridgePathExists(['usage', 'report'])).toBe(true);
    expect(guides.length).toBeGreaterThan(20);
    expect(guides).toContain(join(REPO, 'mcp', 'billing-prompt.md'));
  });

  it.each(guides.map((f) => [relative(REPO, f), f]))('%s', (_name, file) => {
    expect(guideDrift(readFileSync(file, 'utf8'))).toEqual([]);
  });

  describe('goes red on a planted bad line', () => {
    it.each([
      ["```ts\nimport { BridgeAuthProvider } from '@nebulr-group/bridge-react';\n```", "'BridgeAuthProvider' is not exported"],
      ["```ts\nimport { useFlag } from '@nebulr-group/bridge-react/billing';\n```", 'not an entry of the package'],
      ["```ts\nimport { BridgeBillingRoutes } from '@nebulr-group/bridge-react/flags';\n```", "'BridgeBillingRoutes' is not exported by '@nebulr-group/bridge-react/flags'"],
      ['Wrap it in `<BridgePlanGate plan="pro">`.', '<BridgePlanGate> is not a component'],
      ['Use `<TeamManagementPanel seatLimit="seats" />`.', "<TeamManagementPanel> has no prop 'seatLimit'"],
      ['Use `<FeatureFlag flag="beta">`.', "<FeatureFlag> has no prop 'flag'"],
      ['Read it with `usePlan()`.', 'usePlan() is not exported'],
      ['Set `billing.checkoutRoute` to your page.', 'billing.checkoutRoute is not a config option'],
      ["Pass `billing: { successRoute: '/', portalRoute: '/billing' }`.", 'billing.portalRoute is not a config option'],
      ['Call `bridge.usage.increment("exports")`.', 'bridge.usage.increment does not exist'],
    ])('%s', (bad, expected) => {
      const found = guideDrift(bad);
      expect(found.map((d) => d.what).join('\n')).toContain(expected);
    });

    it('and in a real guide file, not only in isolation', () => {
      const planted = `${readFileSync(join(REPO, 'mcp', 'team-prompt.md'), 'utf8')}\n\`<TeamManagementPanel seatLimit="seats" />\`\n`;
      const found = guideDrift(planted);
      expect(found.map((d) => d.what)).toEqual(["<TeamManagementPanel> has no prop 'seatLimit'"]);
    });
  });

  describe('stays green on what the guides really say', () => {
    it.each([
      "```ts\nimport { BridgeProvider, FeatureFlag, type BridgeConfig } from '@nebulr-group/bridge-react';\n```",
      "```ts\nimport { useFlag } from '@nebulr-group/bridge-react/flags';\n```",
      "```ts\nimport { BridgeBillingRoutes } from '@nebulr-group/bridge-react/react-router';\n```",
      '`<TeamManagementPanel seatsMetric="seats" />`',
      '`<FeatureFlag flagKey="analytics" defaultValue={false} upgrade>`',
      "`billing: { successRoute: '/dashboard' }`",
      '`bridge.usage.report(metric)`',
      '`bridge.tenant.subscription`',
      '```tsx\nfunction MyWidget() {\n  return <MyWidget />;\n}\n```',
    ])('%s', (good) => {
      expect(guideDrift(good)).toEqual([]);
    });
  });
});

// @vitest-environment node
/**
 * Color token guard.
 *
 * Scans non-test .ts/.tsx sources under apps/web/src and fails when a file
 * contains a raw hex/rgb/rgba color or a color utility whose palette token is
 * not declared in the @theme block of index.css. index.css and *.test.* files
 * are excluded from the scan.
 */
import { describe, it, expect } from 'vitest';
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Tailwind utility prefixes that take a palette token. */
const COLOR_PREFIXES =
  'bg|text|border|outline|ring|fill|stroke|from|to|via|shadow|placeholder|divide|decoration|accent|caret';

/** Suffixes that are layout/size utilities, not palette tokens. */
const NON_PALETTE_SUFFIXES = new Set([
  'none', 'zero', 'b', 't', 'l', 'r', 'x', 'y', 's', 'e', 'full', 'auto',
  'xs', 'base', 'sm', 'md', 'lg', 'xl',
  '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl',
  'left', 'right', 'center', 'justify',
  'start', 'end', 'top', 'bottom', 'middle', 'all', 'both', 'up', 'down',
  'in', 'out', 'wrap', 'nowrap', 'break-word', 'balance', 'collapse',
  'separate', 'solid', 'dashed', 'dotted', 'double',
]);

/** Raw hex or rgb()/rgba() colors fail the guard on sight. */
const RAW_HEX = /#[0-9a-fA-F]{3,8}\b/;
const RAW_RGB = /\brgba?\(/;
const COLOR_UTILITY = new RegExp(`\\b(${COLOR_PREFIXES})-([a-z0-9/-]+)`, 'g');

interface Violation {
  file: string;
  line: number;
  kind: 'raw-color' | 'undeclared-token';
  detail: string;
}

/**
 * Remove comments from source while preserving line structure, so ids or
 * prose in comments never trip the guard.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(?<!:)\/\/[^\n]*/g, '');
}

/** Parse the @theme block of index.css into a set of bare token names. */
function extractDeclaredTokens(css: string): Set<string> {
  const block = css.match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
  return new Set(
    Array.from(block.matchAll(/--color-([\w-]+)\s*:/g)).map((m) => m[1]),
  );
}

/** Collect non-test .ts/.tsx files under root, recursively. */
function collectSourceFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) {
        files.push(path);
      }
    }
  };
  walk(root);
  return files.sort();
}

/**
 * Report whether a color-utility suffix is a palette token that must be
 * declared. Numeric widths (`border-2`) and known non-color suffixes pass.
 */
function isPaletteToken(suffix: string): boolean {
  if (/^\d+$/.test(suffix)) return false;
  if (NON_PALETTE_SUFFIXES.has(suffix)) return false;
  return true;
}

/**
 * Find color token violations in one comment-stripped source. Import
 * specifier paths such as `./caret-sync` are skipped: the prefix there is a
 * module name, not a Tailwind utility.
 */
function findViolations(
  source: string,
  declared: Set<string>,
  file: string,
): Violation[] {
  const violations: Violation[] = [];
  const lines = source.split('\n');
  lines.forEach((line, i) => {
    const at = (detail: string, kind: Violation['kind']): void => {
      violations.push({ file, line: i + 1, kind, detail });
    };
    if (RAW_HEX.test(line)) at(`raw hex color: ${line.trim()}`, 'raw-color');
    if (RAW_RGB.test(line)) at(`raw rgb() color: ${line.trim()}`, 'raw-color');
    for (const m of line.matchAll(COLOR_UTILITY)) {
      const prefix = m[1];
      const before = line.slice(0, m.index ?? 0);
      if (/(?:^|\s|\W)\.\.?\//.test(before.slice(-3))) continue; // import path
      const token = m[0].slice(prefix.length + 1).split('/')[0];
      if (!isPaletteToken(token) || declared.has(token)) continue;
      at(`undeclared palette token: ${prefix}-${token}`, 'undeclared-token');
    }
  });
  return violations;
}

/** Scan every non-test source under root against the index.css @theme tokens. */
function scanTree(root: string): Violation[] {
  const css = readFileSync(
    fileURLToPath(new URL('./index.css', import.meta.url)),
    'utf8',
  );
  const declared = extractDeclaredTokens(css);
  const violations: Violation[] = [];
  for (const file of collectSourceFiles(root)) {
    violations.push(...findViolations(stripComments(readFileSync(file, 'utf8')), declared, file));
  }
  return violations;
}

/** Run fn over a temp scan root holding the given fixture files, then clean up. */
function withFixtureTree(
  files: Record<string, string>,
  fn: (violations: Violation[]) => void,
): void {
  const root = mkdtempSync(join(tmpdir(), 'color-guard-'));
  try {
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(root, name), content);
    }
    fn(scanTree(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

const srcDir = fileURLToPath(new URL('.', import.meta.url));

/** Assert the scan flags a fixture file containing a raw hex color. */
function assertHexFixtureFails(): void {
  withFixtureTree(
    {
      'FixtureHex.tsx':
        'export const Banner = () => (\n' +
        '  <div className="bg-white" style={{ borderColor: \'#ff0000\' }} />\n' +
        ');\n',
    },
    (violations) => {
      const raw = violations.filter((v) => v.kind === 'raw-color');
      expect(raw.length).toBeGreaterThan(0);
      expect(raw[0].file).toContain('FixtureHex.tsx');
    },
  );
}

/** Assert the scan flags undeclared palette utilities in a fixture file. */
function assertUtilityFixtureFails(): void {
  withFixtureTree(
    {
      'FixtureUtility.tsx':
        'export const Widget = () => (\n' +
        '  <div className="bg-pink-500 text-slate-900" />\n' +
        ');\n',
    },
    (violations) => {
      const undeclared = violations.filter(
        (v) => v.kind === 'undeclared-token',
      );
      expect(undeclared.map((v) => v.detail)).toEqual(
        expect.arrayContaining([
          'undeclared palette token: bg-pink-500',
          'undeclared palette token: text-slate-900',
        ]),
      );
    },
  );
}

/** Assert the scan passes a fixture file that only uses declared tokens. */
function assertCleanFixturePasses(): void {
  withFixtureTree(
    {
      'FixtureClean.tsx':
        'export const Row = () => (\n' +
        '  <div className="border-t border-stone-200 bg-white/70 text-gray-600 shadow-lg" />\n' +
        ');\n',
    },
    (violations) => {
      expect(violations).toEqual([]);
    },
  );
}

describe('color token guard — migrated tree', () => {
  it('uses no raw hex, rgb, or rgba colors in non-test sources', () => {
    const raw = scanTree(srcDir).filter((v) => v.kind === 'raw-color');
    expect(raw).toEqual([]);
  });

  it('uses only declared palette tokens in non-test sources', () => {
    const undeclared = scanTree(srcDir).filter(
      (v) => v.kind === 'undeclared-token',
    );
    expect(undeclared).toEqual([]);
  });

  it('excludes index.css and test files from the scan', () => {
    const scanned = collectSourceFiles(srcDir);
    expect(scanned.some((f) => f.endsWith('index.css'))).toBe(false);
    expect(scanned.some((f) => /\.test\.[tj]sx?$/.test(f))).toBe(false);
  });
});

describe('color token guard — fixture violations', () => {
  it('fails when a fixture file with a raw hex color is added to the scan', () => {
    assertHexFixtureFails();
  });

  it('fails when a fixture file with an undeclared palette utility is added to the scan', () => {
    assertUtilityFixtureFails();
  });

  it('accepts a fixture file that only uses declared tokens', () => {
    assertCleanFixturePasses();
  });
});

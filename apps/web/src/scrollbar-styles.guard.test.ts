// @vitest-environment node
/**
 * Scrollbar style guard.
 *
 * All scrollbar styling lives in `src/scrollbar.css`, which is revealed through
 * the `data-scrolling` attribute that `scrollbar-auto-hide.ts` maintains. A
 * component that styles its own scrollbar would silently opt out of that
 * behaviour, so this guard fails when any other source file declares one.
 */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

/** Component tree scanned by the guard. */
const SOURCE_ROOT = resolve(__dirname);

/** The one stylesheet allowed to declare scrollbar styling. */
const SCROLLBAR_STYLESHEET = 'scrollbar.css';

/** Declarations that only make sense when styling a scrollbar. */
const SCROLLBAR_TOKENS = [
  'scrollbar-width',
  'scrollbar-color',
  'scrollbar-gutter',
  '::-webkit-scrollbar',
  'scrollbarWidth',
  'scrollbarColor',
  'scrollbarGutter',
];

interface Violation {
  file: string;
  line: number;
  token: string;
}

/** Test files are excluded: they may assert on these strings. */
const isTestFile = (name: string): boolean => /\.(test|spec)\.[cm]?[jt]sx?$/.test(name);

/** Only plain sources and stylesheets are scanned, minus the exemptions. */
const isScannable = (name: string): boolean =>
  /\.(ts|tsx|css)$/.test(name) && !isTestFile(name) && name !== SCROLLBAR_STYLESHEET;

/** Record every scrollbar token occurrence in one file. */
function scanFile(path: string, violations: Violation[]): void {
  readFileSync(path, 'utf-8')
    .split('\n')
    .forEach((text, index) => {
      for (const token of SCROLLBAR_TOKENS) {
        if (text.includes(token)) {
          violations.push({ file: path, line: index + 1, token });
        }
      }
    });
}

/**
 * Walk a source tree and report every scrollbar styling occurrence.
 *
 * @param rootDir - Directory to scan recursively.
 * @returns Violations with absolute file path, 1-based line and matched token.
 */
function scan(rootDir: string): Violation[] {
  const violations: Violation[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        if (entry !== 'node_modules') {
          walk(path);
        }
        continue;
      }
      if (isScannable(entry)) {
        scanFile(path, violations);
      }
    }
  };
  walk(rootDir);
  return violations;
}

describe('scrollbar style guard', () => {
  it('finds no scrollbar styling outside scrollbar.css', () => {
    expect(scan(SOURCE_ROOT)).toEqual([]);
  });

  it('reports scrollbar styling with file and line in other files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scrollbar-guard-'));
    try {
      writeFileSync(join(dir, 'Panel.tsx'), "export const style = { scrollbarWidth: 'none' };\n");
      writeFileSync(join(dir, 'panel.css'), '.x {}\n.x::-webkit-scrollbar { display: none; }\n');
      writeFileSync(join(dir, 'scrollbar.css'), '* { scrollbar-width: thin; }\n');
      writeFileSync(join(dir, 'Panel.test.tsx'), "const style = { scrollbarWidth: 'none' };\n");

      const violations = scan(dir);
      const files = violations.map((violation) => relative(dir, violation.file)).sort();
      expect(files).toEqual(['Panel.tsx', 'panel.css']);

      const cssViolation = violations.find((violation) => violation.file.endsWith('panel.css'));
      expect(cssViolation?.line).toBe(2);
      expect(cssViolation?.token).toBe('::-webkit-scrollbar');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

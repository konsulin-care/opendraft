import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../src');

/**
 * Files reachable from the library entry (index.ts) — anything that could
 * end up in a browser bundle. cli.ts is excluded: it is a standalone CLI
 * entry, not exported from index.ts.
 */
const BROWSER_BOUNDARY_FILES = readdirSync(SRC_DIR).filter(
  (f) => f.endsWith('.ts') && f !== 'cli.ts',
);

describe('packages/schema browser boundary', () => {
  it('has no node:* imports in browser-boundary source files', () => {
    expect(BROWSER_BOUNDARY_FILES.length).toBeGreaterThan(0);

    for (const file of BROWSER_BOUNDARY_FILES) {
      const content = readFileSync(resolve(SRC_DIR, file), 'utf-8');
      const nodeImports = [...content.matchAll(/from\s+['"]node:[^'"]+['"]/g)].map(
        (m) => m[0],
      );
      expect(nodeImports, `${file} must not import node:* modules`).toEqual([]);
    }
  });
});
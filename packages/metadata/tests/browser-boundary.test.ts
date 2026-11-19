import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
const ENTRY = resolve(SRC_DIR, 'index.ts');

const RELATIVE_SPECIFIER = /(?:from|import)\s*\(?\s*['"](\.[^'"]+)['"]/g;

/**
 * Resolves a relative import specifier to a file inside `SRC_DIR`.
 *
 * Maps the emitted `.js` extension back to `.ts`, resolves directory
 * specifiers to `index.ts`, and returns `null` for anything outside the
 * package's `src` directory.
 *
 * @param fromFile - Absolute path of the importing file.
 * @param specifier - Relative import specifier as written in the source.
 * @returns Absolute path of the imported TypeScript file, or `null`.
 */
function resolveSpecifier(fromFile: string, specifier: string): string | null {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [base.replace(/\.js$/, '.ts'), base, resolve(base, 'index.ts')];
  const hit = candidates.find((candidate) => existsSync(candidate) && candidate.endsWith('.ts'));
  if (hit === undefined) return null;
  return hit.startsWith(`${SRC_DIR}/`) ? hit : null;
}

/**
 * Walks every relative import/export reachable from `src/index.ts`.
 *
 * @param entry - Absolute path of the entry module.
 * @returns Sorted list of absolute file paths in the reachable module graph.
 */
function reachableFiles(entry: string): string[] {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const current = queue.pop();
    if (current === undefined || seen.has(current)) continue;
    seen.add(current);
    const content = readFileSync(current, 'utf-8');
    for (const match of content.matchAll(RELATIVE_SPECIFIER)) {
      const next = resolveSpecifier(current, match[1] ?? '');
      if (next !== null && !seen.has(next)) queue.push(next);
    }
  }
  return [...seen].sort();
}

describe('packages/metadata browser boundary', () => {
  const files = reachableFiles(ENTRY);

  it('walks a non-trivial module graph from the aggregate entry', () => {
    expect(files.length).toBeGreaterThan(5);
    expect(files).toContain(ENTRY);
  });

  it('has no node:* imports reachable from the aggregate entry', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const staticNode = [...content.matchAll(/(?:from|import)\s*\(?\s*['"]node:[^'"]+['"]/g)].map(
        (m) => m[0],
      );
      if (staticNode.length > 0) offenders.push(`${relative(SRC_DIR, file)}: ${staticNode.join(', ')}`);
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('does not export the node-only compileManuscript or migrateToBlockLayout', () => {
    const entry = readFileSync(ENTRY, 'utf-8');
    expect(entry).not.toMatch(/export\s*\{[^}]*\bcompileManuscript\b/);
    expect(entry).not.toMatch(/export\s*\{[^}]*\bmigrateToBlockLayout\b/);
  });
});

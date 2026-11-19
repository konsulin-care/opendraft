import { describe, expect, it } from 'vitest';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path of the scanned source directory: `packages/rdf/src`. */
const SRC_DIR = fileURLToPath(new URL('../src', import.meta.url));

/**
 * Matches static imports of Node built-ins: an import/export clause with a
 * `node:` specifier (`from 'node:...'`) or a side-effect import
 * (`import 'node:...'`). Dynamic `import('node:...')` calls do not match.
 */
const STATIC_NODE_IMPORT = /(?:\bfrom\s*|\bimport\s*)['"]node:[^'"]*['"]/;

/**
 * Recursively collects every `.ts` file under a directory.
 *
 * @param dir - Directory to walk.
 * @returns Resolves to the absolute paths of all TypeScript files found.
 */
async function collectTypeScriptFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTypeScriptFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('browser safety', () => {
  it('no module in packages/rdf/src statically imports a node: built-in', async () => {
    const files = await collectTypeScriptFiles(SRC_DIR);
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      if (STATIC_NODE_IMPORT.test(source)) {
        offenders.push(file.slice(SRC_DIR.length + 1));
      }
    }

    expect(offenders).toEqual([]);
  });
});

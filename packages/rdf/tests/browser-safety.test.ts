import { afterAll, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTurtle } from '../src/index.js';

/** Absolute path of the scanned source directory: `packages/rdf/src`. */
const SRC_DIR = fileURLToPath(new URL('../src', import.meta.url));

/**
 * Matches static imports of Node built-ins: an import/export clause with a
 * `node:` specifier (`from 'node:...'`) or a side-effect import
 * (`import 'node:...'`). Dynamic `import('node:...')` calls do not match.
 */
const STATIC_NODE_IMPORT = /(?:\bfrom\s*|\bimport\s*)['"]node:[^'"]*['"]/;

/**
 * Matches any `node:` specifier, whether statically imported or loaded through a
 * dynamic `import('node:...')` call.
 */
const ANY_NODE_SPECIFIER = /['"]node:/;

/** File name of the single module allowed to reference `node:` built-ins. */
const NODE_MODULE = 'load-turtle.ts';

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

  it('only load-turtle.ts mentions a node: specifier, static or dynamic', async () => {
    const files = await collectTypeScriptFiles(SRC_DIR);
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of files) {
      const relative = file.slice(SRC_DIR.length + 1);
      if (relative === NODE_MODULE) {
        continue;
      }
      const source = await readFile(file, 'utf8');
      if (ANY_NODE_SPECIFIER.test(source)) {
        offenders.push(relative);
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe('loadTurtle', () => {
  const directories: string[] = [];

  afterAll(async () => {
    await Promise.all(
      directories.map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  it('parses a Turtle file into a dataset', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'opendraft-rdf-'));
    directories.push(directory);
    const path = join(directory, 'sample.ttl');
    await writeFile(
      path,
      '@prefix ex: <http://example.org/> .\nex:s <http://example.org/p> ex:o .\n',
      'utf8',
    );

    const dataset = await loadTurtle(path);
    const quads = [...dataset];

    expect(quads).toHaveLength(1);
    expect(quads[0]?.subject.value).toBe('http://example.org/s');
  });

  it('rejects when the path does not exist', async () => {
    await expect(loadTurtle(join(tmpdir(), 'opendraft-rdf-missing.ttl'))).rejects.toThrow();
  });
});

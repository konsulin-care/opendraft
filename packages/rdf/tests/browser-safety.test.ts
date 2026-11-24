import { afterAll, describe, expect, it } from 'vitest';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTurtle } from '../src/index.js';

/** Absolute path of the scanned source directory: `packages/rdf/src`. */
const SRC_DIR = fileURLToPath(new URL('../src', import.meta.url));

/** Absolute path of the browser entry module. */
const BROWSER_ENTRY = join(SRC_DIR, 'browser.ts');

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

/**
 * Matches the specifier of a relative import or re-export, including
 * side-effect imports (`import './x.js'`) and type-only imports.
 */
const RELATIVE_SPECIFIER = /(?:\bfrom\s*|\bimport\s*|\bexport\s*)[^'"]*?['"](\.[^'"]+)['"]/g;

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

/**
 * Walks the relative static imports and re-exports of an entry module,
 * following `.js` specifiers to their `.ts` sources.
 *
 * @param entry - Absolute path of the starting module.
 * @returns Resolves to the absolute paths of every reachable module.
 */
async function collectReachableModules(entry: string): Promise<Set<string>> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || seen.has(file)) continue;
    seen.add(file);
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(RELATIVE_SPECIFIER)) {
      const specifier = match[1];
      if (specifier === undefined) continue;
      const target = resolve(dirname(file), specifier.replace(/\.js$/, '.ts'));
      if (!seen.has(target)) queue.push(target);
    }
  }
  return seen;
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

describe('browser graph', () => {
  it('no module reachable from browser.ts imports load-turtle.ts', async () => {
    const reachable = await collectReachableModules(BROWSER_ENTRY);
    expect(reachable.size).toBeGreaterThan(1);

    const offenders = [...reachable]
      .map((file) => file.slice(SRC_DIR.length + 1))
      .filter((relative) => relative === NODE_MODULE);

    expect(offenders).toEqual([]);
  });

  it('no module reachable from browser.ts contains a node: specifier', async () => {
    const reachable = await collectReachableModules(BROWSER_ENTRY);

    const offenders: string[] = [];
    for (const file of reachable) {
      const source = await readFile(file, 'utf8');
      if (ANY_NODE_SPECIFIER.test(source)) {
        offenders.push(file.slice(SRC_DIR.length + 1));
      }
    }

    expect(offenders).toEqual([]);
  });

  it('browser.ts exposes the runtime exports of index.ts except loadTurtle', async () => {
    const browserExports = Object.keys(await import('../src/browser.js')).sort();
    const indexExports = Object.keys(await import('../src/index.js'))
      .filter((name) => name !== 'loadTurtle')
      .sort();

    expect(browserExports).toEqual(indexExports);
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

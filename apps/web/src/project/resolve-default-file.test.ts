// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MemoryWorkspace } from '@opendraft/workspace';
import { scaffoldProject } from './scaffold';
import { resolveDefaultFile } from './resolve-default-file';

/**
 * Create a workspace scaffolded with the given manuscript id.
 *
 * @param manuscriptId - Manuscript id passed to `scaffoldProject`.
 * @returns A MemoryWorkspace containing the scaffolded project.
 */
async function scaffoldedWorkspace(manuscriptId: string): Promise<MemoryWorkspace> {
  const ws = new MemoryWorkspace();
  await scaffoldProject(ws, { manuscriptId });
  return ws;
}

describe('resolveDefaultFile with lastPath', () => {
  it('returns lastPath when that file exists', async () => {
    const ws = await scaffoldedWorkspace('p');

    const result = await resolveDefaultFile(ws, 'manuscripts/p/references.bib');
    expect(result).toBe('manuscripts/p/references.bib');
  });

  it('returns lastPath when it is an existing manuscript directory', async () => {
    const ws = await scaffoldedWorkspace('p');

    const result = await resolveDefaultFile(ws, 'manuscripts/p');
    expect(result).toBe('manuscripts/p');
  });

  it('ignores lastPath when neither the file nor anything under it exists', async () => {
    const ws = await scaffoldedWorkspace('p');
    await ws.deleteFile('manuscripts/p/references.bib');

    const result = await resolveDefaultFile(ws, 'manuscripts/p/does-not-exist.bib');
    expect(result).toBe('manuscripts/p');
  });

  it('ignores a lastPath directory that no longer holds files', async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile('notes.md', '# notes\n');

    const result = await resolveDefaultFile(ws, 'manuscripts/gone');
    expect(result).toBe('notes.md');
  });

  it('still wins with a valid file lastPath over the manuscript directory', async () => {
    const ws = await scaffoldedWorkspace('p');

    const result = await resolveDefaultFile(ws, 'manuscripts/p/article.qmd');
    expect(result).toBe('manuscripts/p/article.qmd');
  });
});

/** Read opendraft.yml and assert the default resolution it produces. */
async function expectManifestDefault(yml: string, extra: [string, string], expected: string): Promise<void> {
  const ws = await scaffoldedWorkspace('second');
  await writeManifest(ws, yml, extra);
  expect(await resolveDefaultFile(ws, null)).toBe(expected);
}

/** Write an opendraft.yml plus one manuscript file on a workspace. */
async function writeManifest(ws: MemoryWorkspace, yml: string, extra: [string, string]): Promise<void> {
  await ws.writeFile('opendraft.yml', yml);
  await ws.writeFile(extra[0], extra[1]);
}

/** Seed a manifest entry without a path and assert the fallback default. */
async function expectManifestWithoutPathFallback(): Promise<void> {
  const ws = new MemoryWorkspace();
  await ws.writeFile(
    'opendraft.yml',
    'protocol:\n  version: "1.0"\nmanuscripts:\n  - id: p\n',
  );
  await ws.writeFile('a.qmd', '# a\n');

  const result = await resolveDefaultFile(ws, null);
  expect(result).toBe('a.qmd');
}

/** Seed a config-less workspace and assert the first .qmd/.md fallback. */
async function expectListAllMarkdownFallback(): Promise<void> {
  const ws = new MemoryWorkspace();
  await ws.writeFile('notes.txt', 'text');
  await ws.writeFile('dir/b.md', '# b');
  await ws.writeFile('a.qmd', '# a');

  const result = await resolveDefaultFile(ws, null);
  expect(result).toBe('a.qmd');
}

describe('resolveDefaultFile default path', () => {
  it('returns the manuscript directory for a fresh scaffold', async () => {
    const ws = await scaffoldedWorkspace('p');

    const result = await resolveDefaultFile(ws, null);
    expect(result).toBe('manuscripts/p');
  });

  it('uses the first manuscript path from opendraft.yml', async () => {
    await expectManifestDefault(
      'protocol:\n  version: "1.0"\nmanuscripts:\n  - id: alpha\n    path: manuscripts/alpha\n  - id: second\n    path: manuscripts/second\n',
      ['manuscripts/alpha/article.qmd', '# alpha\n'],
      'manuscripts/alpha',
    );
  });

  it('ignores a manuscript entry without a path string', async () => {
    await expectManifestWithoutPathFallback();
  });

  it('falls back to the first .qmd or .md from listAll without a config', async () => {
    await expectListAllMarkdownFallback();
  });

  it('returns null for an empty workspace', async () => {
    const ws = new MemoryWorkspace();

    const result = await resolveDefaultFile(ws, null);
    expect(result).toBeNull();
  });

  it('returns null when only non-markdown files exist and there is no config', async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile('notes.txt', 'text');

    const result = await resolveDefaultFile(ws, null);
    expect(result).toBeNull();
  });
});

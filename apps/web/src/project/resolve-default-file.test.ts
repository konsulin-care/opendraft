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

describe('resolveDefaultFile with lastPath and opendraft.yml', () => {
  it('returns lastPath when that file exists', async () => {
    const ws = await scaffoldedWorkspace('p');

    const result = await resolveDefaultFile(ws, 'manuscripts/p/references.bib');
    expect(result).toBe('manuscripts/p/references.bib');
  });

  it('ignores lastPath when the file does not exist', async () => {
    const ws = await scaffoldedWorkspace('p');

    const result = await resolveDefaultFile(ws, 'manuscripts/p/does-not-exist.bib');
    expect(result).toBe('manuscripts/p/article.qmd');
  });

  it('falls back to the article when lastPath is null', async () => {
    const ws = await scaffoldedWorkspace('p');

    const result = await resolveDefaultFile(ws, null);
    expect(result).toBe('manuscripts/p/article.qmd');
  });

  it('ignores lastPath when the file was deleted from the workspace', async () => {
    const ws = await scaffoldedWorkspace('p');
    await ws.deleteFile('manuscripts/p/references.bib');

    const result = await resolveDefaultFile(ws, 'manuscripts/p/references.bib');
    expect(result).toBe('manuscripts/p/article.qmd');
  });

  it('uses the first manuscript id from opendraft.yml', async () => {
    const ws = await scaffoldedWorkspace('second');
    await ws.writeFile(
      'opendraft.yml',
      'protocol:\n  version: "1.0"\nmanuscripts:\n  - id: alpha\n    path: manuscripts/alpha\n  - id: second\n    path: manuscripts/second\n',
    );
    await ws.writeFile('manuscripts/alpha/article.qmd', '# alpha\n');

    const result = await resolveDefaultFile(ws, null);
    expect(result).toBe('manuscripts/alpha/article.qmd');
  });
});

describe('resolveDefaultFile without opendraft.yml', () => {
  it('falls back to the first .qmd or .md from listAll', async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile('notes.txt', 'text');
    await ws.writeFile('dir/b.md', '# b');
    await ws.writeFile('a.qmd', '# a');

    const result = await resolveDefaultFile(ws, null);
    expect(result).toBe('a.qmd');
  });

  it('returns null for an empty workspace', async () => {
    const ws = new MemoryWorkspace();

    const result = await resolveDefaultFile(ws, null);
    expect(result).toBeNull();
  });

  it('returns null when only non-markdown files exist', async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile('notes.txt', 'text');

    const result = await resolveDefaultFile(ws, null);
    expect(result).toBeNull();
  });
});

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

/**
 * Resolve the scaffolded starter block path (random lowercase ULID).
 *
 * @param ws - Scaffolded workspace.
 * @returns Repo-relative path of the starter block.
 */
async function starterBlockPath(ws: MemoryWorkspace): Promise<string> {
  const names = await ws.listFiles('manuscripts/p/blocks');
  expect(names).toHaveLength(1);
  return `manuscripts/p/blocks/${names[0]}`;
}

/**
 * Build a workspace with a manuscript whose article.qmd and blocks coexist.
 *
 * @param blockNames - Filenames to create under `manuscripts/p/blocks/`.
 * @returns The populated workspace.
 */
async function manuscriptWithBlocks(blockNames: string[]): Promise<MemoryWorkspace> {
  const ws = new MemoryWorkspace();
  await ws.writeFile(
    'opendraft.yml',
    'protocol:\n  version: "1.0"\nmanuscripts:\n  - id: p\n    path: manuscripts/p\n',
  );
  await ws.writeFile('manuscripts/p/article.qmd', '# container\n');
  for (const name of blockNames) {
    await ws.writeFile(`manuscripts/p/blocks/${name}`, '');
  }
  return ws;
}

describe('resolveDefaultFile with lastPath and opendraft.yml', () => {
  it('returns lastPath when that file exists', async () => {
    const ws = await scaffoldedWorkspace('p');

    const result = await resolveDefaultFile(ws, 'manuscripts/p/references.bib');
    expect(result).toBe('manuscripts/p/references.bib');
  });

  it('prefers the starter block over article.qmd when lastPath does not exist', async () => {
    const ws = await scaffoldedWorkspace('p');
    const block = await starterBlockPath(ws);

    const result = await resolveDefaultFile(ws, 'manuscripts/p/does-not-exist.bib');
    expect(result).toBe(block);
  });

  it('falls back to the starter block when lastPath is null', async () => {
    const ws = await scaffoldedWorkspace('p');
    const block = await starterBlockPath(ws);

    const result = await resolveDefaultFile(ws, null);
    expect(result).toBe(block);
  });

  it('ignores lastPath when the file was deleted from the workspace', async () => {
    const ws = await scaffoldedWorkspace('p');
    const block = await starterBlockPath(ws);
    await ws.deleteFile('manuscripts/p/references.bib');

    const result = await resolveDefaultFile(ws, 'manuscripts/p/references.bib');
    expect(result).toBe(block);
  });

  it('uses the first manuscript id from opendraft.yml', async () => {
    const ws = await scaffoldedWorkspace('second');
    await ws.writeFile(
      'opendraft.yml',
      'protocol:\n  version: "1.0"\nmanuscripts:\n  - id: alpha\n    path: manuscripts/alpha\n  - id: second\n    path: manuscripts/second\n',
    );
    await ws.writeFile('manuscripts/alpha/article.qmd', '# alpha\n');
    await ws.writeFile('manuscripts/alpha/blocks/one.qmd', '');

    const result = await resolveDefaultFile(ws, null);
    expect(result).toBe('manuscripts/alpha/blocks/one.qmd');
  });
});

describe('resolveDefaultFile block resolution', () => {
  it('chooses a block over article.qmd', async () => {
    const ws = await manuscriptWithBlocks(['01hxyz.qmd']);

    const result = await resolveDefaultFile(ws, null);
    expect(result).toBe('manuscripts/p/blocks/01hxyz.qmd');
  });

  it('chooses the first block by sorted name', async () => {
    const ws = await manuscriptWithBlocks(['bbb.qmd', 'aaa.qmd', 'ccc.qmd']);

    const result = await resolveDefaultFile(ws, null);
    expect(result).toBe('manuscripts/p/blocks/aaa.qmd');
  });

  it('falls back to article.qmd when the blocks directory is empty', async () => {
    const ws = await manuscriptWithBlocks([]);

    const result = await resolveDefaultFile(ws, null);
    expect(result).toBe('manuscripts/p/article.qmd');
  });

  it('falls back to article.qmd when the blocks directory is missing', async () => {
    const ws = new MemoryWorkspace();
    await ws.writeFile(
      'opendraft.yml',
      'protocol:\n  version: "1.0"\nmanuscripts:\n  - id: p\n    path: manuscripts/p\n',
    );
    await ws.writeFile('manuscripts/p/article.qmd', '# container\n');

    const result = await resolveDefaultFile(ws, null);
    expect(result).toBe('manuscripts/p/article.qmd');
  });

  it('still wins with a valid lastPath over any block', async () => {
    const ws = await manuscriptWithBlocks(['aaa.qmd']);

    const result = await resolveDefaultFile(ws, 'manuscripts/p/article.qmd');
    expect(result).toBe('manuscripts/p/article.qmd');
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

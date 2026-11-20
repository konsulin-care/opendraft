import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { CompletionContext } from '@codemirror/autocomplete';
import { EditorState } from '@codemirror/state';
import { MemoryWorkspace } from '@opendraft/workspace';
import { sharedBibPath } from '../citation/references-source';
import { manuscriptDirOf, useAtCompletion } from './use-at-completion';

/** Manuscript directory shared by the fixtures. */
const DIR = 'manuscripts/demo';

/**
 * Build a workspace with a bibliography and one manuscript block.
 *
 * @returns A memory workspace holding references.bib and a block file.
 */
async function makeWorkspace(): Promise<MemoryWorkspace> {
  const ws = new MemoryWorkspace();
  await ws.writeFile(
    'manuscripts/references.bib',
    '@article{doe2024,\n  title = {A paper},\n  author = {Doe, Jane},\n  year = {2024}\n}\n',
  );
  await ws.writeFile(`${DIR}/blocks/_intro.qmd`, 'Some text.\n');
  return ws;
}

describe('manuscriptDirOf', () => {
  it('maps both block files and assembly files to the manuscript directory', () => {
    expect(manuscriptDirOf('manuscripts/demo/blocks/_intro.qmd')).toBe(DIR);
    expect(manuscriptDirOf('manuscripts/demo/article.qmd')).toBe(DIR);
    expect(sharedBibPath(manuscriptDirOf('manuscripts/demo/blocks/_intro.qmd'))).toBe(
      'manuscripts/references.bib',
    );
  });

  it('falls back to the dirname and to an empty string at the root', () => {
    expect(manuscriptDirOf('manuscripts/demo/notes.txt')).toBe(DIR);
    expect(manuscriptDirOf('article.qmd')).toBe('');
  });
});

describe('useAtCompletion', () => {
  it('returns one completion source for a .qmd path and none for .md or .bib paths', () => {
    const ws = new MemoryWorkspace();
    const { result, rerender } = renderHook(
      ({ path }: { path: string }) => useAtCompletion(ws, path, ''),
      { initialProps: { path: `${DIR}/blocks/_intro.qmd` } },
    );

    expect(result.current).toHaveLength(1);

    rerender({ path: `${DIR}/notes.md` });
    expect(result.current).toHaveLength(0);

    rerender({ path: 'manuscripts/references.bib' });
    expect(result.current).toHaveLength(0);
  });

  it('reads citations from the shared references.bib of the manuscript', async () => {
    const ws = await makeWorkspace();
    const { result } = renderHook(() =>
      useAtCompletion(ws, `${DIR}/blocks/_intro.qmd`, ''),
    );

    await waitFor(() => expect(result.current).toHaveLength(1));
    const source = result.current[0];
    expect(typeof source).toBe('function');
    if (typeof source !== 'function') return;

    const context = new CompletionContext(EditorState.create({ doc: '@' }), 1, true);
    const completion = await source(context);

    expect(completion?.options.map((option) => option.label)).toContain('@doe2024');
  });
});

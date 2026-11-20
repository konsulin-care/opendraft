import { describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { MemoryWorkspace } from '@opendraft/workspace';
import { useCrossrefIndex } from './use-crossref-index';

/** Manuscript directory used by every fixture. */
const DIR = 'manuscripts/demo';

/** Block short names included by the fixture assembly. */
const SHORTS = ['intro', 'results'];

/**
 * Build a workspace with an assembly that includes two block files.
 *
 * @returns A memory workspace holding the article and both blocks.
 */
async function makeWorkspace(): Promise<MemoryWorkspace> {
  const ws = new MemoryWorkspace();
  await ws.writeFile(
    `${DIR}/article.qmd`,
    [
      '{{< include blocks/_intro.qmd >}}',
      '',
      '{{< include blocks/_results.qmd >}}',
      '',
    ].join('\n'),
  );
  await ws.writeFile(
    `${DIR}/blocks/_intro.qmd`,
    ['## Opening {#sec-opening}', '', 'Some text.', ''].join('\n'),
  );
  await ws.writeFile(
    `${DIR}/blocks/_results.qmd`,
    ['## Results {#sec-results}', '', '![A plot](plot.png){#fig-plot}', ''].join('\n'),
  );
  return ws;
}

/**
 * Map labels to their ids.
 *
 * @param labels - The labels to read.
 * @returns The label ids in order.
 */
function labelIds(labels: { id: string }[]): string[] {
  return labels.map((label) => label.id);
}

describe('useCrossrefIndex loading', () => {
  it('returns the sec anchors and fig labels of the included block files', async () => {
    const ws = await makeWorkspace();
    const { result } = renderHook(() => useCrossrefIndex(ws, DIR, SHORTS));

    await waitFor(() => {
      expect(labelIds(result.current.getCrossrefs())).toEqual([
        'sec-opening',
        'sec-results',
        'fig-plot',
      ]);
    });
    expect(result.current.getCrossrefs().map((label) => label.file)).toEqual([
      '_intro.qmd',
      '_results.qmd',
      '_results.qmd',
    ]);
  });
});

describe('useCrossrefIndex updates', () => {
  it("replaces a file's labels immediately after updateFile", async () => {
    const ws = await makeWorkspace();
    const { result } = renderHook(() => useCrossrefIndex(ws, DIR, SHORTS));
    await waitFor(() => {
      expect(result.current.getCrossrefs()).toHaveLength(3);
    });

    act(() => {
      result.current.updateFile('_intro.qmd', '## Renamed {#sec-renamed}\n');
    });

    const ids = result.current.getCrossrefs().map((label) => label.id);
    expect(ids).toEqual(['sec-renamed', 'sec-results', 'fig-plot']);
  });
});

describe('useCrossrefIndex handle identity', () => {
  it('keeps getCrossrefs and updateFile stable across rerenders', async () => {
    const ws = await makeWorkspace();
    const { result, rerender } = renderHook(() => useCrossrefIndex(ws, DIR, SHORTS));
    const { getCrossrefs, updateFile } = result.current;

    rerender();

    expect(result.current.getCrossrefs).toBe(getCrossrefs);
    expect(result.current.updateFile).toBe(updateFile);
  });
});

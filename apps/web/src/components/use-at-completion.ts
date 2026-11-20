import { useEffect, useMemo } from 'react';
import type { CompletionSource } from '@codemirror/autocomplete';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { createAtCompletionSource } from '../citation/source-completion';
import { readReferences, sharedBibPath } from '../citation/references-source';
import { useCrossrefIndex } from '../crossref/use-crossref-index';

/** Matches a file inside a manuscript's `blocks/` directory. */
const BLOCK_PATH_PATTERN = /^(.*)\/blocks\/[^/]+\.qmd$/;

/**
 * Resolve the manuscript directory that owns a file.
 *
 * Files inside `<dir>/blocks/<file>.qmd` belong to `<dir>`, matching the
 * assembly file `<dir>/article.qmd`. Any other path falls back to its
 * dirname, or an empty string at the workspace root.
 *
 * @param path - Repo-relative workspace path.
 * @returns The manuscript directory, without a trailing slash.
 */
export function manuscriptDirOf(path: string): string {
  const block = BLOCK_PATH_PATTERN.exec(path);
  if (block) return block[1];
  const slash = path.lastIndexOf('/');
  return slash <= 0 ? '' : path.slice(0, slash);
}

/**
 * Read the base name of a workspace path.
 *
 * @param path - Repo-relative workspace path.
 * @returns Everything after the last slash.
 */
function basenameOf(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash === -1 ? path : path.slice(slash + 1);
}

/**
 * Build the CodeMirror `@` completion sources for a manuscript file.
 *
 * Only `.qmd` files get a source. It combines the shared bibliography of the
 * manuscript directory with the cross-reference labels of every block file,
 * refreshing the current file's labels on each buffer change.
 *
 * @param ws - Workspace adapter used for bibliography and block reads.
 * @param path - Repo-relative path of the file being edited.
 * @param buffer - Current markdown text of that file.
 * @returns A single completion source for `.qmd` files, otherwise an empty list.
 */
export function useAtCompletion(
  ws: WorkspaceAdapter,
  path: string,
  buffer: string,
): CompletionSource[] {
  const dir = manuscriptDirOf(path);
  const isQmd = path.endsWith('.qmd');
  const crossrefs = useCrossrefIndex(ws, dir, []);

  useEffect(() => {
    if (!isQmd) return;
    crossrefs.updateFile(basenameOf(path), buffer);
  }, [crossrefs, isQmd, path, buffer]);

  return useMemo(() => {
    if (!isQmd) return [];
    return [
      createAtCompletionSource({
        getReferences: async () =>
          (await readReferences(ws, sharedBibPath(dir))).items,
        getCrossrefs: () => crossrefs.getCrossrefs(),
      }),
    ];
  }, [ws, dir, isQmd, crossrefs]);
}

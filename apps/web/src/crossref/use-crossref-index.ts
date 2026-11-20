/**
 * React hook exposing the in-memory cross-reference label index.
 *
 * The hook loads every block file included by the current manuscript and
 * keeps the labels in a single index stored in a ref, so the returned handle
 * stays the same object across renders. Callers can push fresh markdown into
 * the index through `updateFile` without waiting for a reload.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { listBlocks } from '@opendraft/manuscript';
import type { CrossrefLabel } from '@opendraft/manuscript';
import { createLabelIndex } from './label-index';
import type { LabelIndex } from './label-index';

/** Stable handle returned by {@link useCrossrefIndex}. */
export interface CrossrefIndexHandle {
  /**
   * Read all known cross-reference labels.
   *
   * @returns The merged label list of every loaded block file.
   */
  getCrossrefs(): CrossrefLabel[];
  /**
   * Replace the markdown of one block file in the index.
   *
   * @param file - The block file name the text belongs to.
   * @param text - The latest markdown text of that file.
   * @returns Nothing.
   */
  updateFile(file: string, text: string): void;
}

/** Handle whose methods delegate to a fixed index instance. */
interface RefHandle extends CrossrefIndexHandle {
  /** The index instance backing the handle. */
  index: LabelIndex;
}

/**
 * Create a handle bound to the given index.
 *
 * @param index - The label index to read from and update.
 * @returns A handle with a `getCrossrefs` reader and an `updateFile` writer.
 */
function createHandle(index: LabelIndex): RefHandle {
  return {
    index,
    getCrossrefs: () => index.labels(),
    updateFile: (file, text) => index.update(file, text),
  };
}

/**
 * Load every included block file into the index.
 *
 * @param ws - Workspace holding the manuscript.
 * @param dir - Manuscript directory, e.g. `manuscripts/demo`.
 * @param index - The label index to refresh.
 * @returns Resolves once every included block file has been indexed.
 */
async function loadIndex(
  ws: WorkspaceAdapter,
  dir: string,
  index: LabelIndex,
): Promise<void> {
  const items = await listBlocks(ws, dir);
  const files: string[] = [];
  for (const item of items) {
    const text = await ws.readFile(`${dir}/blocks/${item.file}`);
    if (text === null) continue;
    index.update(item.file, text);
    files.push(item.file);
  }
  index.retain(files);
}

/**
 * Track the cross-reference labels of the current manuscript.
 *
 * Reloads the index whenever the workspace, directory or block list changes.
 *
 * @param ws - Workspace holding the manuscript.
 * @param dir - Manuscript directory, e.g. `manuscripts/demo`.
 * @param shorts - Block short names, used as a reload trigger.
 * @returns A stable handle exposing `getCrossrefs` and `updateFile`.
 */
export function useCrossrefIndex(
  ws: WorkspaceAdapter,
  dir: string,
  shorts: string[],
): CrossrefIndexHandle {
  const handleRef = useRef<RefHandle | null>(null);
  if (handleRef.current === null) {
    handleRef.current = createHandle(createLabelIndex());
  }
  const handle = handleRef.current;
  const key = shorts.join('\n');

  useEffect(() => {
    void loadIndex(ws, dir, handle.index);
  }, [ws, dir, key, handle]);

  const getCrossrefs = useCallback(() => handle.getCrossrefs(), [handle]);
  const updateFile = useCallback(
    (file: string, text: string) => handle.updateFile(file, text),
    [handle],
  );

  return useMemo(() => ({ getCrossrefs, updateFile }), [getCrossrefs, updateFile]);
}

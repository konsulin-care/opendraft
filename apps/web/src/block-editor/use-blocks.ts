/**
 * Block persistence hook: loads blocks in `article.qmd` include order and
 * exposes create, delete, rename and title-change mutations. The block
 * operations themselves live in `@opendraft/manuscript`; this hook binds
 * them to the workspace and refreshes the list after each mutation.
 */
import { useCallback, useEffect, useState } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import {
  addBlock as addBlockFile,
  deleteBlock as deleteBlockFile,
  listBlocks,
  renameBlock as renameBlockFile,
  setBlockTitle,
} from '@opendraft/manuscript';
import type { CreateBlockDraft } from '@opendraft/manuscript';
import { countWords } from './word-count';

export type { CreateBlockDraft };

/** One entry of the block list. */
export interface BlockEntry {
  /** Short name — the block file name without `.qmd`. */
  short: string;
  /** Heading title; falls back to the short name when no heading exists. */
  title: string;
  /** Word count of the body, excluding the heading line; 0 without a file. */
  wordCount: number;
}

/** Value returned by {@link useBlocks}. */
export interface UseBlocksResult {
  /** Whether the initial block list load has settled. */
  loading: boolean;
  /** Blocks in `article.qmd` include order. */
  blocks: BlockEntry[];
  /**
   * Write `blocks/<short>.qmd` and insert its include at `position`.
   * Pass a title string for the legacy derived-identity form, or a
   * {@link CreateBlockDraft} to choose the short name and role.
   */
  createBlock: (position: number, draft: string | CreateBlockDraft) => Promise<void>;
  /** Remove the include line and delete the block file. */
  deleteBlock: (short: string) => Promise<void>;
  /** Rename file + include and rewrite `@sec-` refs in other blocks. */
  renameBlock: (oldShort: string, newShort: string) => Promise<void>;
  /** Rewrite the heading title; file name and anchor stay unchanged. */
  setTitle: (short: string, title: string) => Promise<void>;
}

/** Load the block list in assembly include order with per-body word counts. */
async function readBlocks(ws: WorkspaceAdapter, dir: string): Promise<BlockEntry[]> {
  const items = await listBlocks(ws, dir);
  return items.map(({ short, title, body }) => ({
    short,
    title,
    wordCount: countWords(body),
  }));
}

/** Mutation callbacks of {@link useBlocks}, bound to one workspace. */
type BlockMutations = Pick<
  UseBlocksResult, 'createBlock' | 'deleteBlock' | 'renameBlock' | 'setTitle'
>;

/** Bind the four assembly mutations, each refreshing the block list after. */
function useBlockMutations(
  ws: WorkspaceAdapter,
  dir: string,
  refresh: () => Promise<void>,
): BlockMutations {
  const createBlock = useCallback(
    async (position: number, draft: string | CreateBlockDraft) => {
      await addBlockFile(ws, dir, position, draft);
      await refresh();
    },
    [ws, dir, refresh],
  );
  const deleteBlock = useCallback(
    async (short: string) => {
      await deleteBlockFile(ws, dir, short);
      await refresh();
    },
    [ws, dir, refresh],
  );
  const renameBlock = useCallback(
    async (oldShort: string, newShort: string) => {
      await renameBlockFile(ws, dir, oldShort, newShort);
      await refresh();
    },
    [ws, dir, refresh],
  );
  const setTitle = useCallback(
    async (short: string, title: string) => {
      await setBlockTitle(ws, dir, short, title);
      await refresh();
    },
    [ws, dir, refresh],
  );
  return { createBlock, deleteBlock, renameBlock, setTitle };
}

/**
 * Track and mutate the blocks of a manuscript assembly. The block list loads
 * in `article.qmd` include order whenever the workspace or manuscript
 * directory changes. Each mutation persists through the manuscript package
 * and then refreshes the list.
 * @param ws - Workspace holding the manuscript.
 * @param dir - Manuscript directory, e.g. `manuscripts/demo`.
 * @returns See {@link UseBlocksResult}.
 */
export function useBlocks(ws: WorkspaceAdapter, dir: string): UseBlocksResult {
  const [blocks, setBlocks] = useState<BlockEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setBlocks(await readBlocks(ws, dir));
  }, [ws, dir]);

  useEffect(() => {
    let stale = false;
    setLoading(true);
    readBlocks(ws, dir)
      .then((entries) => {
        if (stale) return;
        setBlocks(entries);
        setLoading(false);
      })
      .catch((err: unknown) => {
        console.error('block list load failed:', err);
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [ws, dir]);

  const mutations = useBlockMutations(ws, dir, refresh);
  return { loading, blocks, ...mutations };
}

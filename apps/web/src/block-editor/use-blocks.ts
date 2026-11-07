/**
 * Block persistence hook: loads blocks in `article.qmd` include order and
 * exposes create, delete, rename and title-change assembly mutations.
 */
import { useCallback, useEffect, useState } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { joinHeading, splitHeading } from './heading';
import type { BlockHeading } from './heading';
import { uniqueShortName } from './slug';

/** One entry of the block list. */
export interface BlockEntry {
  /** Short name — the block file name without `.qmd`. */
  short: string;
  /** Heading title; falls back to the short name when no heading exists. */
  title: string;
}

/** Value returned by {@link useBlocks}. */
export interface UseBlocksResult {
  /** Whether the initial block list load has settled. */
  loading: boolean;
  /** Blocks in `article.qmd` include order. */
  blocks: BlockEntry[];
  /**
   * Write `blocks/<short>.qmd` and insert its include at `position`.
   *
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

/** Draft selecting a new block's own identity instead of deriving it. */
export interface CreateBlockDraft {
  /** Heading title. */
  title: string;
  /** Chosen short name — file stem and `sec-` anchor suffix. */
  short: string;
  /** Role without the `deo-` prefix; omit for a heading with no class. */
  role?: string | null;
}

/** Matches one include shortcode on its own line. */
const INCLUDE_PATTERN = /\{\{< include\s+blocks\/([a-z0-9-]+)\.qmd\s*>\}\}/;

/** Section type given to blocks that carry no type of their own. */
const GENERIC_BLOCK_TYPE = 'section';

/** Extract block short names from an assembly in include order. */
function extractIncludes(article: string): string[] {
  const shorts: string[] = [];
  for (const line of article.split('\n')) {
    const match = INCLUDE_PATTERN.exec(line.trim());
    if (match !== null) shorts.push(match[1]);
  }
  return shorts;
}

/** Splice an include shortcode into the assembly at `position`. */
function insertInclude(article: string, short: string, position: number): string {
  const lines = article.split('\n');
  const indices: number[] = [];
  lines.forEach((line, index) => {
    if (INCLUDE_PATTERN.test(line.trim())) indices.push(index);
  });
  const include = `{{< include blocks/${short}.qmd >}}`;
  if (indices.length === 0) {
    const refs = lines.findIndex((line) => line.trim() === '::: {#refs}');
    lines.splice(refs === -1 ? lines.length : refs, 0, include, '');
    return lines.join('\n');
  }
  const at = Math.min(Math.max(position, 0), indices.length);
  if (at === indices.length) {
    lines.splice(indices[at - 1] + 1, 0, '', include);
  } else {
    lines.splice(indices[at], 0, include, '');
  }
  return lines.join('\n');
}

/** Load the block list in assembly include order, titles from block headings. */
async function readBlocks(ws: WorkspaceAdapter, dir: string): Promise<BlockEntry[]> {
  const article = (await ws.readFile(`${dir}/article.qmd`)) ?? '';
  const entries: BlockEntry[] = [];
  for (const short of extractIncludes(article)) {
    const text = await ws.readFile(`${dir}/blocks/${short}.qmd`);
    const title = text === null ? short : (splitHeading(text).title ?? short);
    entries.push({ short, title });
  }
  return entries;
}

/** Write a new block file and splice its include into the assembly. */
async function writeNewBlock(
  ws: WorkspaceAdapter,
  dir: string,
  position: number,
  draft: string | CreateBlockDraft,
): Promise<void> {
  const articlePath = `${dir}/article.qmd`;
  const article = (await ws.readFile(articlePath)) ?? '';
  const taken = new Set(extractIncludes(article));
  const files = await ws.listFiles(`${dir}/blocks`);
  const isTaken = (candidate: string): boolean =>
    taken.has(candidate) || files.includes(`${candidate}.qmd`);
  const title = typeof draft === 'string' ? draft : draft.title;
  const short = typeof draft === 'string' ? uniqueShortName(title, isTaken) : draft.short;
  const role = typeof draft === 'string' ? GENERIC_BLOCK_TYPE : (draft.role ?? null);
  const heading: BlockHeading = { title, anchor: `sec-${short}`, type: role };
  await ws.writeFile(`${dir}/blocks/${short}.qmd`, joinHeading(heading, ''));
  await ws.writeFile(articlePath, insertInclude(article, short, position));
}

/** Remove a block's include line from the assembly and delete its file. */
async function deleteBlockFile(ws: WorkspaceAdapter, dir: string, short: string): Promise<void> {
  const articlePath = `${dir}/article.qmd`;
  const article = await ws.readFile(articlePath);
  if (article !== null) {
    const kept = article.split('\n').filter((line) => {
      const match = INCLUDE_PATTERN.exec(line.trim());
      return match === null || match[1] !== short;
    });
    await ws.writeFile(articlePath, kept.join('\n'));
  }
  await ws.deleteFile(`${dir}/blocks/${short}.qmd`);
}

/** Move a block's heading anchor and `@sec-` body refs to the new short name. */
function renameIdentity(text: string, oldShort: string, newShort: string): string {
  const parts = splitHeading(text);
  const body = parts.body.replaceAll(`@sec-${oldShort}`, `@sec-${newShort}`);
  if (parts.title === null || parts.anchor === null || parts.type === null) return body;
  const anchor = parts.anchor === `sec-${oldShort}` ? `sec-${newShort}` : parts.anchor;
  return joinHeading({ title: parts.title, anchor, type: parts.type }, body);
}

/** Rewrite `@sec-<old>` refs in every block file but the renamed one. */
async function rewriteOtherRefs(
  ws: WorkspaceAdapter,
  blocksDir: string,
  oldShort: string,
  newShort: string,
): Promise<void> {
  for (const file of await ws.listFiles(blocksDir)) {
    if (file === `${newShort}.qmd`) continue;
    const path = `${blocksDir}/${file}`;
    const text = await ws.readFile(path);
    if (text === null) continue;
    const updated = text.replaceAll(`@sec-${oldShort}`, `@sec-${newShort}`);
    if (updated !== text) await ws.writeFile(path, updated);
  }
}

/** Rename a block: file, include line and cross-block references. */
async function renameBlockFile(
  ws: WorkspaceAdapter,
  dir: string,
  oldShort: string,
  newShort: string,
): Promise<void> {
  const blocksDir = `${dir}/blocks`;
  const oldPath = `${blocksDir}/${oldShort}.qmd`;
  const text = await ws.readFile(oldPath);
  if (text === null) return;
  await ws.writeFile(`${blocksDir}/${newShort}.qmd`, renameIdentity(text, oldShort, newShort));
  await ws.deleteFile(oldPath);
  const articlePath = `${dir}/article.qmd`;
  const article = await ws.readFile(articlePath);
  if (article !== null) {
    await ws.writeFile(
      articlePath,
      article.replaceAll(`blocks/${oldShort}.qmd`, `blocks/${newShort}.qmd`),
    );
  }
  await rewriteOtherRefs(ws, blocksDir, oldShort, newShort);
}

/** Rewrite a block's heading title, keeping file name and anchor. */
async function updateBlockTitle(
  ws: WorkspaceAdapter,
  dir: string,
  short: string,
  title: string,
): Promise<void> {
  const path = `${dir}/blocks/${short}.qmd`;
  const text = await ws.readFile(path);
  if (text === null) return;
  const parts = splitHeading(text);
  const anchor = parts.anchor ?? `sec-${short}`;
  const type = parts.type ?? GENERIC_BLOCK_TYPE;
  await ws.writeFile(path, joinHeading({ title, anchor, type }, parts.body));
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
      await writeNewBlock(ws, dir, position, draft);
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
      await updateBlockTitle(ws, dir, short, title);
      await refresh();
    },
    [ws, dir, refresh],
  );
  return { createBlock, deleteBlock, renameBlock, setTitle };
}

/**
 * Track and mutate the blocks of a manuscript assembly.
 *
 * The block list loads in `article.qmd` include order whenever the
 * workspace or manuscript directory changes. Each mutation persists
 * through the workspace adapter and then refreshes the list.
 *
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

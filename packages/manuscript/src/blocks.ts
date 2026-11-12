/**
 * Block operations on a manuscript assembly.
 *
 * `extractIncludes` and `listBlocks` read `article.qmd` include order and
 * the block files it points at; `addBlock`, `deleteBlock`, `renameBlock`
 * and `setBlockTitle` mutate the assembly and its block files. All
 * operations take a {@link WorkspaceAdapter} and a manuscript directory.
 */
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { joinHeading, retitleHeading, splitHeading } from './heading.js';
import type { BlockHeading } from './heading.js';
import { uniqueShortName } from './slug.js';

/** Draft selecting a new block's own identity instead of deriving it. */
export interface CreateBlockDraft {
  /** Heading title. */
  title: string;
  /** Chosen short name — file stem and `sec-` anchor suffix. */
  short: string;
  /** Role without the `deo-` prefix; omit for the generic `.doco-section` class. */
  role?: string | null;
}

/** One entry returned by {@link listBlocks}. */
export interface BlockListItem {
  /** Short name — the block file name without `.qmd`. */
  short: string;
  /** Heading title; falls back to the short name when no heading exists. */
  title: string;
  /** Text after the heading line; `''` when the block file is missing. */
  body: string;
}

/** Matches one include shortcode on its own line. */
const INCLUDE_PATTERN = /\{\{< include\s+blocks\/([a-z0-9-]+)\.qmd\s*>\}\}/;

/** Section type given to blocks that carry no type of their own. */
const GENERIC_BLOCK_TYPE = 'section';

/**
 * Extract block short names from an assembly in include order.
 *
 * @param article - Full `article.qmd` text.
 * @returns One short name per include line, in include order.
 */
export function extractIncludes(article: string): string[] {
  const shorts: string[] = [];
  for (const line of article.split('\n')) {
    const match = INCLUDE_PATTERN.exec(line.trim());
    if (match !== null) shorts.push(match[1]);
  }
  return shorts;
}

/**
 * Splice an include shortcode into the assembly at `position`.
 *
 * With no existing include the line goes directly before `::: {#refs}`
 * (or at the end when there is no refs fence).
 *
 * @param article - Full `article.qmd` text.
 * @param short - Short name of the block to include.
 * @param position - Zero-based slot among the existing includes.
 * @returns The assembly text with the include inserted.
 */
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

/**
 * Load the block list in assembly include order, titles from block headings.
 *
 * @param ws - Workspace holding the manuscript.
 * @param dir - Manuscript directory, e.g. `manuscripts/demo`.
 * @returns One entry per include line; missing files yield the short name
 *          as title and an empty body.
 */
export async function listBlocks(
  ws: WorkspaceAdapter,
  dir: string,
): Promise<BlockListItem[]> {
  const article = (await ws.readFile(`${dir}/article.qmd`)) ?? '';
  const entries: BlockListItem[] = [];
  for (const short of extractIncludes(article)) {
    const text = await ws.readFile(`${dir}/blocks/${short}.qmd`);
    if (text === null) {
      entries.push({ short, title: short, body: '' });
      continue;
    }
    const parts = splitHeading(text);
    entries.push({ short, title: parts.title ?? short, body: parts.body });
  }
  return entries;
}

/**
 * Write a new block file and splice its include into the assembly.
 *
 * The short name is de-duplicated against existing includes and block
 * files, so a taken name never overwrites an existing block. A string
 * draft derives the identity from its title; a {@link CreateBlockDraft}
 * chooses it, defaulting to the generic `.doco-section` class when no
 * role is given.
 *
 * @param ws - Workspace holding the manuscript.
 * @param dir - Manuscript directory, e.g. `manuscripts/demo`.
 * @param position - Zero-based slot among the existing includes.
 * @param draft - Title string or explicit identity draft.
 * @returns Resolves once the block file and assembly are written.
 */
export async function addBlock(
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
  const short = uniqueShortName(typeof draft === 'string' ? title : draft.short, isTaken);
  const role = typeof draft === 'string' ? GENERIC_BLOCK_TYPE : (draft.role ?? GENERIC_BLOCK_TYPE);
  const heading: BlockHeading = { title, anchor: `sec-${short}`, type: role };
  await ws.writeFile(`${dir}/blocks/${short}.qmd`, joinHeading(heading, ''));
  await ws.writeFile(articlePath, insertInclude(article, short, position));
}

/**
 * Remove a block's include line from the assembly and delete its file.
 *
 * @param ws - Workspace holding the manuscript.
 * @param dir - Manuscript directory, e.g. `manuscripts/demo`.
 * @param short - Short name of the block to delete.
 * @returns Resolves once the include is removed and the file deleted.
 */
export async function deleteBlock(
  ws: WorkspaceAdapter,
  dir: string,
  short: string,
): Promise<void> {
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

/**
 * Move a block's heading anchor and `@sec-` body refs to the new short name.
 *
 * @param text - Full block file text.
 * @param oldShort - Current short name.
 * @param newShort - Replacement short name.
 * @returns Block text with anchor and refs updated.
 */
function renameIdentity(text: string, oldShort: string, newShort: string): string {
  const parts = splitHeading(text);
  const body = parts.body.replaceAll(`@sec-${oldShort}`, `@sec-${newShort}`);
  // Re-emit the heading exactly as parsed: a class-less heading stays class-less.
  if (parts.title === null || parts.anchor === null) return body;
  const anchor = parts.anchor === `sec-${oldShort}` ? `sec-${newShort}` : parts.anchor;
  return joinHeading({ title: parts.title, anchor, type: parts.type }, body);
}

/**
 * Rewrite `@sec-<old>` refs in every block file but the renamed one.
 *
 * @param ws - Workspace holding the manuscript.
 * @param blocksDir - Directory holding the block files.
 * @param oldShort - Short name being renamed away.
 * @param newShort - Short name being renamed to.
 * @returns Resolves once every ref-bearing file is rewritten.
 */
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

/**
 * Rename a block: file, include line and cross-block references.
 *
 * @param ws - Workspace holding the manuscript.
 * @param dir - Manuscript directory, e.g. `manuscripts/demo`.
 * @param oldShort - Current short name.
 * @param newShort - Replacement short name.
 * @returns Resolves once the file, include and refs are updated.
 */
export async function renameBlock(
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

/**
 * Rewrite a block's heading title, keeping file name and anchor.
 *
 * A file without a canonical heading gets one prepended, anchored at the
 * short name and class-less.
 *
 * @param ws - Workspace holding the manuscript.
 * @param dir - Manuscript directory, e.g. `manuscripts/demo`.
 * @param short - Short name of the block to retitle.
 * @param title - New heading title.
 * @returns Resolves once the block file is rewritten.
 */
export async function setBlockTitle(
  ws: WorkspaceAdapter,
  dir: string,
  short: string,
  title: string,
): Promise<void> {
  const path = `${dir}/blocks/${short}.qmd`;
  const text = await ws.readFile(path);
  if (text === null) return;
  const parts = splitHeading(text);
  if (parts.title !== null) {
    // Rewrite only the title: the anchor and class token stay byte-for-byte.
    await ws.writeFile(path, retitleHeading(text, title));
    return;
  }
  await ws.writeFile(path, joinHeading({ title, anchor: `sec-${short}`, type: null }, text));
}

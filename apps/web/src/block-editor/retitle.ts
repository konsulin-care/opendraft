/**
 * Title-driven block identity: `retitleBlock` rewrites a block's heading
 * title and, when the new title's slug differs from the block's current
 * short name, renames the block through the rename path — file, include,
 * heading anchor and other blocks' `@sec-` references — de-duplicating the
 * derived short name against the other blocks.
 */
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { extractIncludes, renameBlockFile, updateBlockTitle } from './use-blocks';
import { normalizeShortName, uniqueShortName } from './slug';

/** Normalized titles that derive a conventional abbreviated short name. */
const ABBREVIATED_SLUGS: Record<string, string> = { introduction: 'intro' };

/**
 * Build the taken-name predicate feeding `uniqueShortName`.
 *
 * Gathers short names from the assembly's include lines and the block
 * files on disk, then drops the retitled block's own short and own file
 * first, so its current name never counts as taken.
 *
 * @param ws - Workspace holding the manuscript.
 * @param dir - Manuscript directory, e.g. `manuscripts/demo`.
 * @param short - Short name of the block being retitled.
 * @returns Predicate reporting whether a candidate short name is owned
 *          by another block's include line or file.
 */
async function buildIsTaken(
  ws: WorkspaceAdapter,
  dir: string,
  short: string,
): Promise<(candidate: string) => boolean> {
  const article = (await ws.readFile(`${dir}/article.qmd`)) ?? '';
  const taken = new Set(extractIncludes(article));
  taken.delete(short);
  const files = new Set(await ws.listFiles(`${dir}/blocks`));
  files.delete(`${short}.qmd`);
  return (candidate: string): boolean =>
    taken.has(candidate) || files.has(`${candidate}.qmd`);
}

/**
 * Retitle a block, renaming it when the new title's slug differs.
 *
 * The new short name comes from `uniqueShortName` over the title after
 * applying the conventional abbreviation map (`introduction` -> `intro`);
 * the block's own current name never counts as taken, so a title that
 * still normalizes to the current short leaves file and anchor in place
 * and only the heading title is rewritten. When the short changes, the
 * rename path moves the file, include line, heading anchor and other
 * blocks' `@sec-` references before the new title is written.
 *
 * @param ws - Workspace holding the manuscript.
 * @param dir - Manuscript directory, e.g. `manuscripts/demo`.
 * @param short - Current short name of the block being retitled.
 * @param title - New heading title.
 * @returns The resulting short name, unique-suffixed when the slug was taken.
 */
export async function retitleBlock(
  ws: WorkspaceAdapter,
  dir: string,
  short: string,
  title: string,
): Promise<string> {
  const isTaken = await buildIsTaken(ws, dir, short);
  const derived = ABBREVIATED_SLUGS[normalizeShortName(title)] ?? title;
  const next = uniqueShortName(derived, isTaken);
  if (next !== short) await renameBlockFile(ws, dir, short, next);
  await updateBlockTitle(ws, dir, next, title);
  return next;
}

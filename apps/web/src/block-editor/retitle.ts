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
  const article = (await ws.readFile(`${dir}/article.qmd`)) ?? '';
  const taken = new Set(extractIncludes(article));
  taken.delete(short);
  const ownFile = `${short}.qmd`;
  const files = (await ws.listFiles(`${dir}/blocks`)).filter((file) => file !== ownFile);
  const isTaken = (candidate: string): boolean =>
    taken.has(candidate) || files.includes(`${candidate}.qmd`);
  const derived = ABBREVIATED_SLUGS[normalizeShortName(title)] ?? title;
  const next = uniqueShortName(derived, isTaken);
  if (next !== short) await renameBlockFile(ws, dir, short, next);
  await updateBlockTitle(ws, dir, next, title);
  return next;
}

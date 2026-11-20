/**
 * Cross-block reference rewriting for block renames.
 *
 * `renameIdentity` updates the renamed block's own heading anchor and body
 * references; `rewriteOtherRefs` updates references in every other block
 * file. Both use {@link rewriteSectionRefs} so Pandoc key boundaries and
 * code skipping apply consistently.
 */
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { blockFileName } from '@opendraft/schema';
import { joinHeading, splitHeading } from './heading.js';
import { rewriteSectionRefs } from './section-refs.js';

/**
 * Move a block's heading anchor and `@sec-` body refs to the new short name.
 *
 * @param text - Full block file text.
 * @param oldShort - Current short name.
 * @param newShort - Replacement short name.
 * @returns Block text with anchor and refs updated.
 */
export function renameIdentity(text: string, oldShort: string, newShort: string): string {
  const parts = splitHeading(text);
  const body = rewriteSectionRefs(parts.body, oldShort, newShort);
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
export async function rewriteOtherRefs(
  ws: WorkspaceAdapter,
  blocksDir: string,
  oldShort: string,
  newShort: string,
): Promise<void> {
  for (const file of await ws.listFiles(blocksDir)) {
    if (file === blockFileName(newShort) || file === `${newShort}.qmd`) continue;
    const path = `${blocksDir}/${file}`;
    const text = await ws.readFile(path);
    if (text === null) continue;
    const updated = rewriteSectionRefs(text, oldShort, newShort);
    if (updated !== text) await ws.writeFile(path, updated);
  }
}

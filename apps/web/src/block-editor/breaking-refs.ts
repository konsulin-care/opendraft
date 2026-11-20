/**
 * Collect the `@sec-<short>` references in other block files that would
 * break when a block is deleted.
 */
import { countSectionRefs } from '@opendraft/manuscript';
import { legacyBlockShort, parseBlockFileName } from '@opendraft/schema';
import type { WorkspaceAdapter } from '@opendraft/workspace';

/**
 * Collect every `@sec-<short>` reference in other block files that
 * would break on delete, one entry per occurrence, sorted.
 *
 * File names parse through `parseBlockFileName` with `legacyBlockShort`
 * as fallback: the target is skipped by identity, sources named by short.
 * Reference matching uses `countSectionRefs`, so code spans and partial
 * key matches are ignored.
 *
 * @param ws - Workspace holding the manuscript.
 * @param dir - Manuscript directory.
 * @param short - Short name of the block about to be deleted.
 * @returns One `'@sec-<short> in <source>'` string per occurrence.
 */
export async function findBreakingRefs(
  ws: WorkspaceAdapter,
  dir: string,
  short: string,
): Promise<string[]> {
  const token = `@sec-${short}`;
  const refs: string[] = [];
  for (const file of await ws.listFiles(`${dir}/blocks`)) {
    const source = parseBlockFileName(file) ?? legacyBlockShort(file);
    if (source === null || source === short) continue;
    const text = await ws.readFile(`${dir}/blocks/${file}`);
    if (text === null) continue;
    for (let i = 0; i < countSectionRefs(text, short); i += 1) {
      refs.push(`${token} in ${source}`);
    }
  }
  return refs.sort();
}

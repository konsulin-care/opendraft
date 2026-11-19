/**
 * Block file-name resolution for a manuscript's `blocks/` directory.
 *
 * A block's identity (the short name) is stable while its file name may
 * be the prefixed `_<short>.qmd` form or the legacy un-prefixed
 * `<short>.qmd` form. Every block operation resolves the real file once
 * through these helpers so reads, writes and deletes always act on the
 * file that exists on disk.
 */
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { blockFileName } from '@opendraft/schema';

/**
 * Pick the real block file name from a listing of `blocks/`.
 *
 * Prefers the prefixed `_<short>.qmd`, falls back to the legacy
 * un-prefixed `<short>.qmd` and defaults to `_<short>.qmd` when neither
 * exists yet (a block file about to be created).
 *
 * @param files - File names present in the `blocks/` directory.
 * @param short - Block short name (no underscore).
 * @returns The file name to read or write for the short.
 */
export function resolveFromFileList(files: string[], short: string): string {
  const prefixed = blockFileName(short);
  if (files.includes(prefixed)) return prefixed;
  if (files.includes(`${short}.qmd`)) return `${short}.qmd`;
  return prefixed;
}

/**
 * Resolve the on-disk block file for a short name in a manuscript.
 *
 * @param ws - Workspace holding the manuscript.
 * @param dir - Manuscript directory, e.g. `manuscripts/demo`.
 * @param short - Block short name (no underscore).
 * @returns Existing file name: `_<short>.qmd` when present, otherwise
 *          legacy `<short>.qmd`, otherwise `_<short>.qmd`.
 */
export async function resolveBlockFile(
  ws: WorkspaceAdapter,
  dir: string,
  short: string,
): Promise<string> {
  const files = await ws.listFiles(`${dir}/blocks`);
  return resolveFromFileList(files, short);
}

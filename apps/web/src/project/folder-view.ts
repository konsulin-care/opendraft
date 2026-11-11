/** Where a directory path routes in the editor region. */
export type FolderView =
  /** A manuscript root (or a folder under it): open the block editor. */
  | { kind: 'manuscript'; root: string }
  /** The manuscripts root: the overview (notice until T10). */
  | { kind: 'overview' }
  /** Any other folder: not viewable in the shell. */
  | { kind: 'unavailable' };

/**
 * Classify a directory path for the editor region.
 *
 * `manuscripts/<id>` and every folder under `manuscripts/<id>/` route to
 * the block editor for that manuscript root; the `manuscripts` root routes
 * to the overview; every other directory is not viewable.
 *
 * @param path - Repo-relative directory path.
 * @returns The routed view: the manuscript root, the overview, or unavailable.
 */
export function folderView(path: string): FolderView {
  const segments = path.replace(/\/+$/, '').split('/').filter((segment) => segment !== '');
  if (segments[0] !== 'manuscripts') return { kind: 'unavailable' };
  if (segments.length === 1) return { kind: 'overview' };
  return { kind: 'manuscript', root: `manuscripts/${segments[1]}` };
}

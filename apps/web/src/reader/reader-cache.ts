/**
 * Reader snapshot cache.
 *
 * Anonymous reader snapshots are persisted per commit in IndexedDB so that a
 * reload or a later navigation does not re-fetch the whole repository. A
 * snapshot is only considered complete once the marker file has been written
 * as the last step of `saveSnapshot`.
 */

import { IndexedDBWorkspace } from '@opendraft/workspace';

/** Marker written after every file of a snapshot has been stored. */
export const COMPLETE_MARKER = '.opendraft-reader-complete';

/**
 * Compute the cache workspace id for one repository commit.
 *
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param sha - Commit SHA the snapshot is pinned to.
 * @returns The lowercased workspace id `reader-<owner>-<repo>-<sha>`.
 */
export function readerWorkspaceId(owner: string, repo: string, sha: string): string {
  return `reader-${owner}-${repo}-${sha}`.toLowerCase();
}

/**
 * Save a complete snapshot of a repository commit.
 *
 * All files are written first; the completion marker is written afterwards so
 * an interrupted save is never mistaken for a complete snapshot.
 *
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param sha - Commit SHA the snapshot is pinned to.
 * @param files - File contents keyed by repository-relative path.
 * @returns Resolves when all files and the marker are stored.
 */
export async function saveSnapshot(
  owner: string,
  repo: string,
  sha: string,
  files: Map<string, string>,
): Promise<void> {
  const workspace = new IndexedDBWorkspace(readerWorkspaceId(owner, repo, sha));
  try {
    for (const [path, content] of files) {
      await workspace.writeFile(path, content);
    }
    await workspace.writeFile(COMPLETE_MARKER, '1');
  } finally {
    await workspace.close();
  }
}

/**
 * Load a previously saved snapshot for a repository commit.
 *
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param sha - Commit SHA the snapshot is pinned to.
 * @returns All cached files except the marker, or null when no complete
 * snapshot exists for this commit.
 */
export async function loadSnapshot(
  owner: string,
  repo: string,
  sha: string,
): Promise<Map<string, string> | null> {
  const workspace = new IndexedDBWorkspace(readerWorkspaceId(owner, repo, sha));
  try {
    const marker = await workspace.readFile(COMPLETE_MARKER);
    if (marker === null) return null;

    const files = new Map<string, string>();
    for (const path of await workspace.listAll()) {
      if (path === COMPLETE_MARKER) continue;
      const content = await workspace.readFile(path);
      if (content !== null) files.set(path, content);
    }
    return files;
  } finally {
    await workspace.close();
  }
}

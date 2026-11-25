/**
 * Reader snapshot cache.
 *
 * Anonymous reader snapshots are persisted per commit in IndexedDB so that a
 * reload or a later navigation does not re-fetch the whole repository. A
 * snapshot is only considered complete once the marker file has been written
 * as the last step of `saveSnapshot`.
 */

import { IndexedDBWorkspace, workspaceDbName } from '@opendraft/workspace';

/** Marker written after every file of a snapshot has been stored. */
export const COMPLETE_MARKER = '.opendraft-reader-complete';

/** Workspace id of the registry that tracks private reader snapshots. */
const PRIVATE_REGISTRY_ID = 'reader-index';

/** Directory prefix of private snapshot registry entries. */
const PRIVATE_PREFIX = 'private/';

/** Directory prefix of latest-SHA pointer files, owned by the cache pointer task. */
const LATEST_PREFIX = 'latest/';

/** Options accepted by {@link saveSnapshot}. */
export interface SaveSnapshotOptions {
  /** Record this snapshot for deletion when the viewer signs out. */
  private?: boolean;
}

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
 * Remember a snapshot id in the private registry.
 *
 * The registry is a workspace whose file names are the snapshot ids, so an
 * empty file is enough to record one.
 *
 * @param workspaceId - Reader workspace id of the private snapshot.
 * @returns Resolves when the registry entry is stored.
 */
async function registerPrivateSnapshot(workspaceId: string): Promise<void> {
  const registry = new IndexedDBWorkspace(PRIVATE_REGISTRY_ID);
  try {
    await registry.writeFile(`${PRIVATE_PREFIX}${workspaceId}`, '');
  } finally {
    await registry.close();
  }
}

/**
 * Delete one IndexedDB database by name.
 *
 * The delete request is asynchronous and has no promise API, so it is wrapped
 * here. A blocked request resolves as well: the browser defers deletion until
 * the last connection closes, and the purge must not hang on it.
 *
 * @param name - Database name, normally produced by `workspaceDbName`.
 * @returns Resolves once the browser handled the delete request.
 */
function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`Failed to delete ${name}`));
    request.onblocked = () => resolve();
  });
}

/**
 * Check whether a pointer file refers to one of the purged snapshots.
 *
 * Pointer formats are owned by another cache task; a pointer counts as
 * matching when its trimmed content equals or contains a snapshot workspace id
 * or its IndexedDB database name.
 *
 * @param content - Raw pointer file contents.
 * @param targets - Workspace ids and database names being purged.
 * @returns True when the pointer should be removed.
 */
function pointsAtSnapshot(content: string, targets: Set<string>): boolean {
  const trimmed = content.trim();
  for (const target of targets) {
    if (trimmed === target || trimmed.includes(target)) return true;
  }
  return false;
}

/**
 * Save a complete snapshot of a repository commit.
 *
 * All files are written first; the completion marker is written afterwards so
 * an interrupted save is never mistaken for a complete snapshot. A private
 * snapshot is additionally recorded in the private registry.
 *
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param sha - Commit SHA the snapshot is pinned to.
 * @param files - File contents keyed by repository-relative path.
 * @param options - Optional flags; `private` records the snapshot for logout purge.
 * @returns Resolves when all files and the marker are stored.
 */
// The public cache API keeps positional owner/repo/sha/files plus optional flags.
// eslint-disable-next-line max-params
export async function saveSnapshot(
  owner: string,
  repo: string,
  sha: string,
  files: Map<string, string>,
  options?: SaveSnapshotOptions,
): Promise<void> {
  const workspaceId = readerWorkspaceId(owner, repo, sha);
  const workspace = new IndexedDBWorkspace(workspaceId);
  try {
    for (const [path, content] of files) {
      await workspace.writeFile(path, content);
    }
    await workspace.writeFile(COMPLETE_MARKER, '1');
  } finally {
    await workspace.close();
  }

  if (options?.private) {
    await registerPrivateSnapshot(workspaceId);
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

/**
 * Compute the pointer path that stores the latest SHA for a repository ref.
 *
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param ref - Branch or tag name, or undefined for the default branch.
 * @returns The lowercased pointer path `latest/<owner>/<repo>@<ref|HEAD>`.
 */
function latestPointerPath(owner: string, repo: string, ref: string | undefined): string {
  return `${LATEST_PREFIX}${owner}/${repo}@${ref ?? 'HEAD'}`.toLowerCase();
}

/**
 * Save the latest known commit SHA for a repository ref.
 *
 * The pointer is stored in the shared reader registry so a later load can
 * open the cached snapshot without asking the backend for the SHA first.
 *
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param ref - Branch or tag name, or undefined for the default branch.
 * @param sha - Commit SHA currently considered the latest for this ref.
 * @returns Resolves when the pointer file is stored.
 */
export async function saveLatest(
  owner: string,
  repo: string,
  ref: string | undefined,
  sha: string,
): Promise<void> {
  const registry = new IndexedDBWorkspace(PRIVATE_REGISTRY_ID);
  try {
    await registry.writeFile(latestPointerPath(owner, repo, ref), sha);
  } finally {
    await registry.close();
  }
}

/**
 * Load the cached latest commit SHA for a repository ref.
 *
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param ref - Branch or tag name, or undefined for the default branch.
 * @returns The pointed SHA when the pointer exists and its snapshot is
 * complete, otherwise null.
 */
export async function loadLatest(
  owner: string,
  repo: string,
  ref: string | undefined,
): Promise<string | null> {
  const registry = new IndexedDBWorkspace(PRIVATE_REGISTRY_ID);
  try {
    const sha = await registry.readFile(latestPointerPath(owner, repo, ref));
    if (sha === null) return null;

    const snapshot = await loadSnapshot(owner, repo, sha);
    return snapshot === null ? null : sha;
  } finally {
    await registry.close();
  }
}

/**
 * Delete every snapshot recorded as private and clear the registry.
 *
 * Latest-SHA pointer files that refer to a purged snapshot are removed as
 * well, although the pointer feature may not exist in a given build.
 *
 * @returns Resolves when all private snapshot databases and registry entries
 * are gone.
 */
export async function purgePrivateSnapshots(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;

  const registry = new IndexedDBWorkspace(PRIVATE_REGISTRY_ID);
  try {
    const paths = await registry.listAll();
    const ids = new Set(
      paths
        .filter((path) => path.startsWith(PRIVATE_PREFIX))
        .map((path) => path.slice(PRIVATE_PREFIX.length))
        .filter((id) => id.length > 0),
    );
    if (ids.size === 0) return;

    const targets = new Set<string>();
    for (const id of ids) {
      targets.add(id);
      targets.add(workspaceDbName(id));
    }

    for (const path of paths) {
      if (!path.startsWith(LATEST_PREFIX)) continue;
      const content = await registry.readFile(path);
      if (content !== null && pointsAtSnapshot(content, targets)) {
        await registry.deleteFile(path);
      }
    }

    for (const id of ids) {
      await deleteDatabase(workspaceDbName(id));
    }
    for (const id of ids) {
      await registry.deleteFile(`${PRIVATE_PREFIX}${id}`);
    }
  } finally {
    await registry.close();
  }
}

/**
 * Suggestion file scoping and local change detection.
 *
 * Only `opendraft.yml` and `manuscripts/**` are part of a suggestion. Local
 * changes are compared against a per-file content digest so untouched files
 * are never written back over newer upstream content.
 */

/** File name of the OpenDraft project configuration. */
const CONFIG_FILE = 'opendraft.yml';

/** Directory that contains manuscript sources. */
const MANUSCRIPTS_DIR = 'manuscripts/';

/**
 * Decide whether a path belongs to a suggestion.
 *
 * @param path - Repository-relative file path.
 * @returns `true` for `opendraft.yml` and anything under `manuscripts/`.
 */
export function isSuggestionPath(path: string): boolean {
  return path === CONFIG_FILE || path.startsWith(MANUSCRIPTS_DIR);
}

/**
 * Hash file content with 32-bit FNV-1a.
 *
 * The hash is deterministic across platforms and runs, which is all the
 * digest needs: it detects whether a file changed since it was synced.
 *
 * @param content - File content to hash.
 * @returns Eight-character hexadecimal digest.
 */
function hashContent(content: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Build a content digest for the suggestion-scoped files.
 *
 * Paths outside the suggestion scope are ignored.
 *
 * @param files - Map of repository-relative path to file content.
 * @returns Record of scoped path to content digest.
 */
export function fileDigest(files: ReadonlyMap<string, string>): Record<string, string> {
  const digest: Record<string, string> = {};

  for (const [path, content] of files) {
    if (isSuggestionPath(path)) {
      digest[path] = hashContent(content);
    }
  }

  return digest;
}

/** Local files that differ from the digest, plus paths removed locally. */
export interface LocalChanges {
  /** Scoped local paths whose content is new or differs from the digest. */
  changed: Map<string, string>;
  /** Digest paths that no longer exist locally. */
  removed: string[];
}

/**
 * Compare local files against a previously stored digest.
 *
 * Only suggestion-scoped paths are reported. A local path is changed when the
 * digest has no entry for it or its content hash differs; a digest path
 * missing from the local map is removed.
 *
 * @param local - Map of local repository-relative path to file content.
 * @param digest - Previously stored record of path to content digest.
 * @returns Changed local files and removed digest paths.
 */
export function localChanges(
  local: ReadonlyMap<string, string>,
  digest: Record<string, string>,
): LocalChanges {
  const changed = new Map<string, string>();

  for (const [path, content] of local) {
    if (isSuggestionPath(path) && digest[path] !== hashContent(content)) {
      changed.set(path, content);
    }
  }

  const removed = Object.keys(digest).filter(
    (path) => isSuggestionPath(path) && !local.has(path),
  );

  return { changed, removed };
}

/**
 * Decide whether local files differ from a digest.
 *
 * @param local - Map of local repository-relative path to file content.
 * @param digest - Previously stored record of path to content digest.
 * @returns `true` when {@link localChanges} reports a change or removal.
 */
export function isDirty(
  local: ReadonlyMap<string, string>,
  digest: Record<string, string>,
): boolean {
  const { changed, removed } = localChanges(local, digest);
  return changed.size > 0 || removed.length > 0;
}

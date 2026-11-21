/**
 * Repository loader for the reader.
 *
 * Resolves a reader route to one pinned commit, preferring the IndexedDB
 * snapshot cache, then the anonymous public GitHub API and — only for a
 * signed-in viewer of a repository the anonymous path cannot see — the
 * authenticated git relay. The result is always a read-only workspace.
 */

import type { WorkspaceAdapter } from '@opendraft/workspace';
import { MemoryWorkspace, readOnlyWorkspace } from '@opendraft/workspace';
import { parse } from 'yaml';
import { NotFoundError } from './github-public';
import type { PublicSnapshot } from './github-public';
import type { ReaderRoute } from './route';

/** Path of the project configuration file inside a repository. */
const CONFIG_PATH = 'opendraft.yml';

/** One manuscript listed in `opendraft.yml`. */
export interface ManuscriptEntry {
  /** Manuscript id, e.g. `demo`. */
  id: string;
  /** Repository-relative manuscript directory, e.g. `manuscripts/demo`. */
  path: string;
}

/** A loaded repository pinned to one commit. */
export interface LoadedRepo {
  /** Commit SHA the snapshot is pinned to. */
  sha: string;
  /** Read-only workspace over the repository files. */
  workspace: WorkspaceAdapter;
  /** Whether the repository contains `opendraft.yml`. */
  isOpenDraft: boolean;
  /** Manuscripts declared in `opendraft.yml`; empty without the file. */
  manuscripts: ManuscriptEntry[];
}

/** A snapshot returned by the anonymous or relayed load path. */
export interface RepoSnapshot {
  /** Commit SHA the files belong to. */
  sha: string;
  /** File contents keyed by repository-relative path. */
  files: Map<string, string>;
}

/** Injected dependencies of {@link loadRepo}. */
export interface LoadRepoDeps {
  /** Resolve a ref (default `HEAD`) to a commit SHA. */
  resolveCommit: (owner: string, repo: string, ref?: string) => Promise<{ sha: string }>;
  /** Load the reader-visible files of a public repository anonymously. */
  loadPublicSnapshot: (owner: string, repo: string, ref?: string) => Promise<PublicSnapshot>;
  /** Snapshot cache keyed by owner, repo and commit SHA. */
  cache: {
    loadSnapshot: (owner: string, repo: string, sha: string) => Promise<Map<string, string> | null>;
    saveSnapshot: (
      owner: string,
      repo: string,
      sha: string,
      files: Map<string, string>,
    ) => Promise<void>;
  };
  /** Current BFF session identity, or null when anonymous. */
  getSession: () => Promise<unknown>;
  /** Clone a private repository through the authenticated git relay. */
  cloneViaRelay: (owner: string, repo: string, ref?: string) => Promise<RepoSnapshot>;
}

/**
 * Parse the manuscript list out of an `opendraft.yml` document.
 *
 * @param raw - Raw file contents of `opendraft.yml`.
 * @returns Every well-formed `{ id, path }` entry; empty when unparseable.
 */
export function parseManuscripts(raw: string): ManuscriptEntry[] {
  let config: unknown;
  try {
    config = parse(raw);
  } catch {
    return [];
  }
  if (typeof config !== 'object' || config === null) return [];

  const listed = (config as { manuscripts?: unknown }).manuscripts;
  if (!Array.isArray(listed)) return [];

  const entries: ManuscriptEntry[] = [];
  for (const item of listed) {
    if (typeof item !== 'object' || item === null) continue;
    const { id, path } = item as { id?: unknown; path?: unknown };
    if (typeof id === 'string' && typeof path === 'string') {
      entries.push({ id, path });
    }
  }
  return entries;
}

/**
 * Build the read-only workspace plus derived project metadata for a snapshot.
 *
 * @param snapshot - Commit SHA and file contents to expose.
 * @returns The loaded repository description.
 */
async function toLoadedRepo(snapshot: RepoSnapshot): Promise<LoadedRepo> {
  const inner = new MemoryWorkspace();
  for (const [path, content] of snapshot.files) {
    await inner.writeFile(path, content);
  }

  const config = snapshot.files.get(CONFIG_PATH);

  return {
    sha: snapshot.sha,
    workspace: readOnlyWorkspace(inner),
    isOpenDraft: config !== undefined,
    manuscripts: config === undefined ? [] : parseManuscripts(config),
  };
}

/**
 * Load a repository at a route into a read-only workspace.
 *
 * Resolves the ref first so every load pins to one commit, then answers from
 * the snapshot cache when possible. A `NotFoundError` from the anonymous path
 * falls back to the relay clone when a session exists, and is rethrown for an
 * anonymous viewer.
 *
 * @param route - Parsed reader route with owner, repo and optional ref.
 * @param deps - Injected GitHub, cache, session and relay dependencies.
 * @returns The pinned commit, read-only workspace and project metadata.
 */
export async function loadRepo(route: ReaderRoute, deps: LoadRepoDeps): Promise<LoadedRepo> {
  const { owner, repo, ref } = route;

  try {
    const commit = await deps.resolveCommit(owner, repo, ref);

    const cached = await deps.cache.loadSnapshot(owner, repo, commit.sha);
    if (cached !== null) {
      return toLoadedRepo({ sha: commit.sha, files: cached });
    }

    const snapshot = await deps.loadPublicSnapshot(owner, repo, ref);
    await deps.cache.saveSnapshot(owner, repo, snapshot.sha, snapshot.files);
    return toLoadedRepo(snapshot);
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error;

    const session = await deps.getSession();
    if (!session) throw error;

    const snapshot = await deps.cloneViaRelay(owner, repo, ref);
    return toLoadedRepo(snapshot);
  }
}

/**
 * Clone a repository through the authenticated git relay.
 *
 * Loads the Buffer polyfill and the git implementation lazily so the
 * anonymous reader path never bundles or executes isomorphic-git.
 *
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param ref - Optional branch or ref to check out.
 * @returns The resolved commit SHA and all working-tree files.
 */
export async function cloneViaRelay(
  owner: string,
  repo: string,
  ref?: string,
): Promise<RepoSnapshot> {
  await import('../github/buffer-polyfill');
  const { RemoteGit, relayUrl, readWorkingFiles } = await import('@opendraft/git');
  const http = (await import('../../../../packages/git/node_modules/isomorphic-git/http/web/index.js')).default;

  const remote = new RemoteGit({ http });
  const { sha } = await remote.clone(relayUrl(window.location.origin, owner, repo), ref);
  const files = await readWorkingFiles(remote.fs, remote.dir);

  return { sha, files };
}

export default cloneViaRelay;

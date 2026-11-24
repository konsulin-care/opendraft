/** Repository loader for the reader, preferring cache, then GitHub, then the relay. */

import type { WorkspaceAdapter } from '@opendraft/workspace';
import { MemoryWorkspace, readOnlyWorkspace } from '@opendraft/workspace';
import { parse } from 'yaml';
import { loadPublicSnapshot as loadGithubPublicSnapshot, NotFoundError } from './github-public';
import type { PublicSnapshot, ResolvedCommit } from './github-public';
import type { SaveSnapshotOptions } from './reader-cache';
import type { ReaderRoute } from './route';

/** A stage reported while a repository is being loaded. */
export type LoadPhase = 'checking' | 'opening' | 'downloading' | 'saving' | 'preparing';

/** Callback invoked with each loading phase. */
export type OnLoadPhase = (phase: LoadPhase) => void;

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
  /** Resolve the current commit and return it when it differs from this snapshot. */
  checkForUpdate?: () => Promise<string | null>;
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
  /** Resolve a ref (default `HEAD`) to a commit SHA and its root tree. */
  resolveCommit: (owner: string, repo: string, ref?: string) => Promise<ResolvedCommit>;
  /** Load the reader-visible files of a public repository anonymously. */
  loadPublicSnapshot: (
    owner: string,
    repo: string,
    ref: string | undefined,
    commit: ResolvedCommit,
  ) => Promise<PublicSnapshot>;
  /** Snapshot cache keyed by owner, repo and commit SHA. */
  cache: {
    loadSnapshot: (owner: string, repo: string, sha: string) => Promise<Map<string, string> | null>;
    // Mirrors reader-cache.saveSnapshot: positional owner/repo/sha/files plus flags.
    /* eslint-disable max-params */
    saveSnapshot: (
      owner: string,
      repo: string,
      sha: string,
      files: Map<string, string>,
      options?: SaveSnapshotOptions,
    ) => Promise<void>;
    /* eslint-enable max-params */
    /** Load the cached latest SHA for a ref, or null without a complete snapshot. */
    loadLatest?: (owner: string, repo: string, ref: string | undefined) => Promise<string | null>;
    /** Store the latest SHA pointer for a ref. */
    saveLatest?: (owner: string, repo: string, ref: string | undefined, sha: string) => Promise<void>;
  };
  /** Current BFF session identity, or null when anonymous. */
  getSession: () => Promise<unknown>;
  /** Clone a private repository through the authenticated git relay. */
  cloneViaRelay: (owner: string, repo: string, ref?: string) => Promise<RepoSnapshot>;
}

/** Loader shape emitted by the default GitHub dependency before T14. */
type LegacyLoadPublicSnapshot = (
  owner: string,
  repo: string,
  ref?: string,
) => Promise<PublicSnapshot>;

/** Dependencies accepted for compatibility with the pre-T14 default wiring. */
type LegacyLoadRepoDeps = Omit<LoadRepoDeps, 'loadPublicSnapshot'> & {
  loadPublicSnapshot: LegacyLoadPublicSnapshot;
};

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

/** Build the read-only workspace plus derived project metadata for a snapshot. */
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
 * Load a public snapshot at an already resolved commit.
 *
 * This adapter is the dependency wired into the reader's default deps; it
 * avoids a second commit lookup because {@link loadRepo} already resolved the
 * ref before deciding between the cache and the network.
 *
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param ref - Ref the route selected; unused once the commit is known.
 * @param commit - Commit resolved by {@link loadRepo}.
 * @returns The public snapshot pinned to the given commit.
 */
export function loadPublicSnapshotAtCommit(
  owner: string,
  repo: string,
  ref: string | undefined,
  commit: ResolvedCommit,
): Promise<PublicSnapshot> {
  return loadGithubPublicSnapshot(owner, repo, ref, fetch, { commit });
}

/** Store the latest-SHA pointer when the cache dependency supports it. */
async function saveLatestPointer(
  deps: LoadRepoDeps | LegacyLoadRepoDeps,
  route: ReaderRoute,
  sha: string,
): Promise<void> {
  if (deps.cache.saveLatest) await deps.cache.saveLatest(route.owner, route.repo, route.ref, sha);
}

/** Open the cached latest snapshot with a background update check, if possible. */
async function openLatestSnapshot(
  route: ReaderRoute,
  deps: LoadRepoDeps | LegacyLoadRepoDeps,
  onPhase: OnLoadPhase,
): Promise<LoadedRepo | null> {
  if (!deps.cache.loadLatest) return null;

  const { owner, repo, ref } = route;
  const latest = await deps.cache.loadLatest(owner, repo, ref);
  if (latest === null) return null;

  const files = await deps.cache.loadSnapshot(owner, repo, latest);
  if (files === null) return null;

  onPhase('opening');
  const loaded = await toLoadedRepo({ sha: latest, files });
  return {
    ...loaded,
    checkForUpdate: async () => {
      const commit = await deps.resolveCommit(owner, repo, ref);
      return commit.sha === latest ? null : commit.sha;
    },
  };
}

/** Resolve the ref and load the snapshot from cache, GitHub or the relay. */
async function loadFromNetwork(
  route: ReaderRoute,
  deps: LoadRepoDeps | LegacyLoadRepoDeps,
  onPhase: OnLoadPhase,
  loadSnapshotForCommit: LoadRepoDeps['loadPublicSnapshot'],
): Promise<LoadedRepo> {
  const { owner, repo, ref } = route;
  let downloadStarted = false;

  try {
    const commit = await deps.resolveCommit(owner, repo, ref);
    onPhase('checking');

    const cached = await deps.cache.loadSnapshot(owner, repo, commit.sha);
    if (cached !== null) {
      onPhase('opening');
      await saveLatestPointer(deps, route, commit.sha);
      return await toLoadedRepo({ sha: commit.sha, files: cached });
    }

    downloadStarted = true;
    onPhase('downloading');
    const snapshot = await loadSnapshotForCommit(owner, repo, ref, commit);
    onPhase('saving');
    await deps.cache.saveSnapshot(owner, repo, snapshot.sha, snapshot.files);
    await saveLatestPointer(deps, route, snapshot.sha);
    onPhase('preparing');
    return await toLoadedRepo(snapshot);
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error;

    const session = await deps.getSession();
    if (!session) throw error;

    if (!downloadStarted) onPhase('downloading');
    const snapshot = await deps.cloneViaRelay(owner, repo, ref);
    onPhase('saving');
    await deps.cache.saveSnapshot(owner, repo, snapshot.sha, snapshot.files, { private: true });
    await saveLatestPointer(deps, route, snapshot.sha);
    onPhase('preparing');
    return await toLoadedRepo(snapshot);
  }
}

/**
 * Load a repository at a route into a read-only workspace.
 *
 * Resolves the ref first so every load pins to one commit, then answers from
 * the snapshot cache when possible. A `NotFoundError` from the anonymous path
 * falls back to the relay clone when a session exists, and is rethrown for an
 * anonymous viewer. Loading progress is reported through `onPhase`.
 * @param route - Parsed reader route with owner, repo and optional ref.
 * @param deps - Injected GitHub, cache, session and relay dependencies.
 * @param onPhase - Optional callback receiving each loading phase in order.
 * @param options - Loading options; `fresh` ignores the latest-SHA pointer.
 * @returns The pinned commit, read-only workspace and project metadata.
 */
export async function loadRepo(
  route: ReaderRoute,
  deps: LoadRepoDeps | LegacyLoadRepoDeps,
  onPhase: OnLoadPhase = () => {},
  options: { fresh?: boolean } = {},
): Promise<LoadedRepo> {
  const loadSnapshotForCommit: LoadRepoDeps['loadPublicSnapshot'] =
    deps.loadPublicSnapshot === loadGithubPublicSnapshot
      ? loadPublicSnapshotAtCommit
      : (deps.loadPublicSnapshot as LoadRepoDeps['loadPublicSnapshot']);

  if (!options.fresh) {
    const opened = await openLatestSnapshot(route, deps, onPhase);
    if (opened !== null) return opened;
  }

  return loadFromNetwork(route, deps, onPhase, loadSnapshotForCommit);
}

/**
 * Clone a repository through the authenticated git relay.
 * Loads the Buffer polyfill and the git implementation lazily so the
 * anonymous reader path never bundles or executes isomorphic-git.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param ref - Optional branch or ref to check out.
 * @returns The resolved commit SHA and all working-tree files.
 */
export async function cloneViaRelay(owner: string, repo: string, ref?: string): Promise<RepoSnapshot> {
  await import('../github/buffer-polyfill');
  const { RemoteGit, relayUrl, readWorkingFiles } = await import('@opendraft/git');
  const http = (await import('../../../../packages/git/node_modules/isomorphic-git/http/web/index.js')).default;

  const remote = new RemoteGit({ http });
  const { sha } = await remote.clone(relayUrl(window.location.origin, owner, repo), ref);
  const files = await readWorkingFiles(remote.fs, remote.dir);

  return { sha, files };
}

export default cloneViaRelay;

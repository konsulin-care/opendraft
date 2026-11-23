/**
 * Save the local edits of a suggestion project to its remote branch.
 *
 * The target is cloned at the suggestion branch when it has already been
 * pushed, otherwise at the upstream default branch. Only files that differ
 * from the stored per-file digest are committed, so untouched upstream content
 * is never reverted. Every GitHub, git, registry and workspace operation is
 * injected to keep the module unit-testable.
 */

import type {
  ProjectRecord,
  ProjectSourceGitHub,
  WorkspaceAdapter,
} from '@opendraft/workspace';
import type { BffSession } from '../github/bff-client';
import { author } from '../reader/convert';
import { fileDigest, isSuggestionPath, localChanges } from './file-diff';

/** Commit message used when saving suggestion edits. */
export const SAVE_COMMIT_MESSAGE = 'docs: save suggestion changes';

/** Options of {@link saveToCopy}. */
export interface SaveOptions {
  /** Commit local versions even when the remote branch moved since the last sync. */
  overwrite?: boolean;
}

/** Result of {@link saveToCopy}. */
export type SaveResult =
  | { kind: 'saved'; sha: string; upstreamMoved: boolean }
  | { kind: 'unchanged' }
  | { kind: 'remote-moved' };

/** A cloned repository filesystem and working directory. */
export interface SaveClone {
  /** Head commit SHA of the cloned branch or default branch. */
  sha: string;
  /** Git filesystem client used by the commit and push helpers. */
  fs: unknown;
  /** Repository working directory. */
  dir: string;
}

/** Commit request handed to the injected `commitFilesOnBranch`. */
export interface SaveCommitOptions {
  /** Branch to create and commit on. */
  branch: string;
  /** Repository-relative paths and their new contents. */
  files: Map<string, string>;
  /** Repository-relative paths deleted locally. */
  remove: string[];
  /** Commit message. */
  message: string;
  /** Commit author identity. */
  author: { name: string; email: string };
}

/** Registry operations needed by {@link saveToCopy}. */
export interface SaveRegistry {
  /** Read a project record. */
  get: (id: string) => Promise<ProjectRecord | undefined>;
  /** Replace a project's GitHub source. */
  setSource: (
    id: string,
    source: ProjectSourceGitHub,
  ) => Promise<{ id: string; source: ProjectSourceGitHub }>;
}

/** Injected dependencies of {@link saveToCopy}. */
export interface SaveDeps {
  /** Registry used to read and update the project source. */
  registry: SaveRegistry;
  /** Open the workspace of a project id. */
  getWorkspace: (id: string) => Promise<WorkspaceAdapter>;
  /** Clone a repository, optionally at a branch, through the git relay. */
  clone: (owner: string, repo: string, ref?: string) => Promise<SaveClone>;
  /** Build the relay URL for a repository. */
  relayUrl: (owner: string, repo: string) => string;
  /** Read all working-tree files of a cloned repository. */
  readWorkingFiles: (fs: unknown, dir: string) => Promise<Map<string, string>>;
  /** Commit a file map and removals onto a branch. */
  commitFilesOnBranch: (
    fs: unknown,
    dir: string,
    opts: SaveCommitOptions,
  ) => Promise<string>;
  /** Push a local branch to a relay URL. */
  push: (fs: unknown, dir: string, url: string, branch: string) => Promise<void>;
  /** Signed-in BFF session identity used as the commit author. */
  session: BffSession;
}

/**
 * Read the suggestion-scoped files of a workspace.
 *
 * @param workspace - Project workspace.
 * @returns Map of repository-relative path to file content.
 */
async function readScopedFiles(workspace: WorkspaceAdapter): Promise<Map<string, string>> {
  const files = new Map<string, string>();

  for (const path of await workspace.listAll()) {
    if (!isSuggestionPath(path)) continue;
    const content = await workspace.readFile(path);
    if (content !== null) files.set(path, content);
  }

  return files;
}

/**
 * Load the GitHub source of a suggestion project.
 *
 * @param projectId - Project id to load.
 * @param deps - Injected dependencies.
 * @returns The stored GitHub source.
 * @throws Error when the project is missing or is not backed by GitHub.
 */
async function loadSource(
  projectId: string,
  deps: SaveDeps,
): Promise<ProjectSourceGitHub> {
  const project = await deps.registry.get(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  if (project.source.kind !== 'github') {
    throw new Error(`Project is not a GitHub suggestion: ${projectId}`);
  }
  return project.source;
}

/**
 * Save local suggestion edits to the project's remote branch.
 *
 * The project is cloned at the pushed suggestion branch, or at the upstream
 * default branch when it has not been pushed yet. When the pushed branch head
 * differs from the synced commit, the call returns `remote-moved` unless
 * `overwrite` asks to commit the local versions on top of the remote head.
 * Changed and removed scoped files are committed and pushed; a clean workspace
 * returns `unchanged` without touching the remote. An unpushed suggestion whose
 * base moved is saved with `upstreamMoved: true` as a warning only.
 *
 * @param projectId - Project id of the suggestion.
 * @param options - Optional overwrite of a moved remote branch.
 * @param deps - Injected GitHub, git, registry and workspace dependencies.
 * @returns The save outcome, the new commit SHA and an upstream-moved warning.
 */
export async function saveToCopy(
  projectId: string,
  options: SaveOptions,
  deps: SaveDeps,
): Promise<SaveResult> {
  const source = await loadSource(projectId, deps);
  const ref = source.pushed ? source.branch : source.upstream.defaultBranch;
  const cloned = await deps.clone(source.owner, source.repo, ref);

  const remoteMoved = source.pushed && cloned.sha !== source.syncedSha;
  if (remoteMoved && options.overwrite !== true) {
    return { kind: 'remote-moved' };
  }

  const workspace = await deps.getWorkspace(projectId);
  const local = await readScopedFiles(workspace);
  const { changed, removed } = localChanges(local, source.digest);
  if (changed.size === 0 && removed.length === 0) {
    return { kind: 'unchanged' };
  }

  const sha = await deps.commitFilesOnBranch(cloned.fs, cloned.dir, {
    branch: source.branch,
    files: changed,
    remove: removed,
    message: SAVE_COMMIT_MESSAGE,
    author: author(deps.session),
  });
  await deps.push(
    cloned.fs,
    cloned.dir,
    deps.relayUrl(source.owner, source.repo),
    source.branch,
  );

  const committed = await deps.readWorkingFiles(cloned.fs, cloned.dir);
  await deps.registry.setSource(projectId, {
    ...source,
    pushed: true,
    syncedSha: sha,
    digest: fileDigest(committed),
  });

  return {
    kind: 'saved',
    sha,
    upstreamMoved: !source.pushed && cloned.sha !== source.syncedSha,
  };
}

export default saveToCopy;

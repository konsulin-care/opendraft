/**
 * Save draft edits to GitHub.
 *
 * A save commits the workspace into the project's persistent repository with an
 * automatic message, then pushes the draft branch. Offline pushes keep the
 * local commit. A moved remote branch is fetched and rebased onto before push.
 */

import type {
  ProjectRecord,
  ProjectSourceGitHub,
  WorkspaceAdapter,
} from '@opendraft/workspace';
import type { BffSession } from '../github/bff-client';
import { author } from '../reader/convert';
import { fileDigest, isSuggestionPath } from './file-diff';

/** Commit message used by the legacy save-to-copy path. */
export const SAVE_COMMIT_MESSAGE = 'docs: save suggestion changes';

/** Options of {@link saveToCopy}. */
export interface SaveOptions {
  overwrite?: boolean;
}

/** Result of {@link saveToCopy}. */
export type SaveResult =
  | { kind: 'saved'; sha: string; upstreamMoved: boolean }
  | { kind: 'unchanged' }
  | { kind: 'remote-moved' };

/** A cloned repository filesystem and working directory. */
export interface SaveClone {
  sha: string;
  fs: unknown;
  dir: string;
}

/** Commit request handed to `commitFilesOnBranch`. */
export interface SaveCommitOptions {
  branch: string;
  files: Map<string, string>;
  remove: string[];
  message: string;
  author: { name: string; email: string };
}

/** Registry operations needed by saves. */
export interface SaveRegistry {
  get: (id: string) => Promise<ProjectRecord | undefined>;
  setSource: (id: string, source: ProjectSourceGitHub) => Promise<unknown>;
}

/** Injected dependencies of the legacy {@link saveToCopy}. */
export interface SaveDeps {
  registry: SaveRegistry;
  getWorkspace: (id: string) => Promise<WorkspaceAdapter>;
  clone: (owner: string, repo: string, ref?: string) => Promise<SaveClone>;
  relayUrl: (owner: string, repo: string) => string;
  readWorkingFiles: (fs: unknown, dir: string) => Promise<Map<string, string>>;
  commitFilesOnBranch: (fs: unknown, dir: string, opts: SaveCommitOptions) => Promise<string>;
  push: (fs: unknown, dir: string, url: string, branch: string) => Promise<void>;
  session: BffSession;
}

/** An opened persistent draft repository. */
export interface SaveGitHubRepo {
  fs: unknown;
  dir: string;
  branch: string;
}

/** Per-file conflict choice. */
export type SaveConflictChoice = 'mine' | 'theirs';

/** Resolve conflicting paths after replaying local commits. */
export type SaveConflictResolver = (
  paths: string[],
) => Promise<Record<string, SaveConflictChoice>> | Record<string, SaveConflictChoice>;

/** Options of the injected rebase operation. */
export interface SaveRebaseOptions {
  fs: unknown;
  dir: string;
  branch: string;
  onto: string;
  from: string;
  resolve: SaveConflictResolver;
}

/** Dependencies of {@link saveDraft}. */
export interface SaveGitHubDeps extends SaveDeps {
  openRepo: (project: ProjectRecord) => Promise<SaveGitHubRepo>;
  commitWorkspace: (projectId: string, message: string) => Promise<string | null>;
  headSha: (fs: unknown, dir: string) => Promise<string>;
  fetch: (fs: unknown, dir: string, url: string, branch: string) => Promise<void>;
  remoteHead: (fs: unknown, dir: string, branch: string) => Promise<string | null>;
  unpushed: (fs: unknown, dir: string, ref: string) => Promise<string[]>;
  rebaseOnto: (opts: SaveRebaseOptions) => Promise<{ tip: string; backup: string }>;
  resolveConflicts: SaveConflictResolver;
}

/** Result of {@link saveDraft}. */
export type SaveGitHubResult =
  | { kind: 'saved'; sha: string }
  | { kind: 'pending'; pendingSaves: number }
  | { kind: 'unchanged' };

/**
 * Build a save commit message from changed repository paths.
 *
 * @param paths - Changed or removed repository-relative paths.
 * @returns Message using up to three basenames, then `+N more`.
 */
export function saveCommitMessage(paths: string[]): string {
  const names = [...new Set(paths.map((path) => path.split('/').pop() ?? path))].sort();
  const shown = names.slice(0, 3);
  const suffix = names.length > 3 ? `, +${names.length - 3} more` : '';
  return `Update ${shown.join(', ')}${suffix}`;
}

/** Read the suggestion-scoped files of a workspace. */
async function readScopedFiles(workspace: WorkspaceAdapter): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  for (const path of await workspace.listAll()) {
    if (!isSuggestionPath(path)) continue;
    const content = await workspace.readFile(path);
    if (content !== null) files.set(path, content);
  }
  return files;
}

/** Keep only suggestion-scoped repository files. */
function scoped(files: ReadonlyMap<string, string>): Map<string, string> {
  return new Map([...files].filter(([path]) => isSuggestionPath(path)));
}

/** List workspace paths that differ from the repository worktree. */
async function changedPaths(
  projectId: string,
  repo: SaveGitHubRepo,
  deps: SaveGitHubDeps,
): Promise<string[]> {
  const local = await readScopedFiles(await deps.getWorkspace(projectId));
  const remote = scoped(await deps.readWorkingFiles(repo.fs, repo.dir));
  const paths: string[] = [];
  for (const [path, content] of local) if (remote.get(path) !== content) paths.push(path);
  for (const path of remote.keys()) if (!local.has(path)) paths.push(path);
  return paths;
}

/** Load the GitHub source of a draft project. */
async function loadSource(projectId: string, deps: SaveDeps): Promise<ProjectSourceGitHub> {
  const project = await deps.registry.get(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  if (project.source.kind !== 'github') {
    throw new Error(`Project is not a GitHub project: ${projectId}`);
  }
  return project.source;
}

/** Decide whether a thrown value looks like a network failure. */
function isNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (typeof error !== 'object' || error === null) return false;
  const code = 'code' in error ? String((error as { code: unknown }).code) : '';
  if (/network|fetch|timeout|offline/i.test(code)) return true;
  if (code === 'HttpError') {
    const status = (error as { data?: { statusCode?: number } }).data?.statusCode;
    return status === undefined || status >= 500 || status === 408 || status === 429;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /failed to fetch|network|offline|timeout/i.test(message);
}

/** Rebase onto a moved remote draft branch when needed. */
async function rebaseIfMoved(
  source: ProjectSourceGitHub,
  repo: SaveGitHubRepo,
  deps: SaveGitHubDeps,
): Promise<void> {
  if (!source.pushed || !source.syncedSha) return;
  const branch = source.branch;
  await deps.fetch(repo.fs, repo.dir, deps.relayUrl(source.owner, source.repo), branch);
  const head = await deps.remoteHead(repo.fs, repo.dir, branch);
  if (head === null || head === source.syncedSha) return;
  await deps.rebaseOnto({
    fs: repo.fs, dir: repo.dir, branch, onto: `origin/${branch}`,
    from: source.syncedSha, resolve: deps.resolveConflicts,
  });
}

/** Store the synced digest of the repository worktree. */
async function storeDigest(
  projectId: string,
  source: ProjectSourceGitHub,
  repo: SaveGitHubRepo,
  deps: SaveGitHubDeps,
): Promise<void> {
  const files = await deps.readWorkingFiles(repo.fs, repo.dir);
  await deps.registry.setSource(projectId, {
    ...source,
    digest: fileDigest(files),
  });
}

/**
 * Commit workspace changes and push the draft branch to GitHub.
 *
 * @param projectId - Project id of the draft.
 * @param deps - Injected repository, git, registry and conflict dependencies.
 * @returns Saved, pending with a save count, or unchanged.
 */
export async function saveDraft(
  projectId: string,
  deps: SaveGitHubDeps,
): Promise<SaveGitHubResult> {
  const project = await deps.registry.get(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  const source = await loadSource(projectId, deps);
  const repo = await deps.openRepo(project);
  const paths = await changedPaths(projectId, repo, deps);
  const commit = paths.length > 0
    ? await deps.commitWorkspace(projectId, saveCommitMessage(paths))
    : null;
  const remoteRef = source.pushed ? `origin/${source.branch}` : source.syncedSha;
  const pending = await deps.unpushed(repo.fs, repo.dir, remoteRef);
  if (commit === null && pending.length === 0) return { kind: 'unchanged' };
  try {
    await rebaseIfMoved(source, repo, deps);
    await deps.push(repo.fs, repo.dir, deps.relayUrl(source.owner, source.repo), source.branch);
    const sha = await deps.headSha(repo.fs, repo.dir);
    await storeDigest(projectId, { ...source, pushed: true, syncedSha: sha }, repo, deps);
    return { kind: 'saved', sha };
  } catch (error) {
    if (!isNetworkFailure(error)) throw error;
    const waiting = await deps.unpushed(repo.fs, repo.dir, remoteRef);
    await storeDigest(projectId, source, repo, deps);
    return { kind: 'pending', pendingSaves: waiting.length };
  }
}

/**
 * Save local suggestion edits to a cloned copy (legacy submit flow).
 *
 * @param projectId - Project id.
 * @param options - Optional overwrite of a moved branch.
 * @param deps - Injected dependencies.
 * @returns The legacy save outcome.
 */
export async function saveToCopy(
  projectId: string,
  options: SaveOptions,
  deps: SaveDeps,
): Promise<SaveResult> {
  const source = await loadSource(projectId, deps);
  const ref = source.pushed ? source.branch : source.upstream.defaultBranch;
  const cloned = await deps.clone(source.owner, source.repo, ref);
  if (source.pushed && cloned.sha !== source.syncedSha && options.overwrite !== true) {
    return { kind: 'remote-moved' };
  }
  const local = await readScopedFiles(await deps.getWorkspace(projectId));
  const remote = scoped(await deps.readWorkingFiles(cloned.fs, cloned.dir));
  const files = new Map<string, string>();
  for (const [path, content] of local) if (remote.get(path) !== content) files.set(path, content);
  const remove = [...remote.keys()].filter((path) => !local.has(path));
  if (files.size === 0 && remove.length === 0) return { kind: 'unchanged' };
  const sha = await deps.commitFilesOnBranch(cloned.fs, cloned.dir, {
    branch: source.branch, files, remove, message: SAVE_COMMIT_MESSAGE,
    author: author(deps.session),
  });
  await deps.push(cloned.fs, cloned.dir, deps.relayUrl(source.owner, source.repo), source.branch);
  const committed = await deps.readWorkingFiles(cloned.fs, cloned.dir);
  await deps.registry.setSource(projectId, {
    ...source, pushed: true, syncedSha: sha, digest: fileDigest(committed),
  });
  return { kind: 'saved', sha, upstreamMoved: !source.pushed && cloned.sha !== source.syncedSha };
}

/** Alias of {@link saveDraft} using the Save to GitHub wording. */
export const saveToGitHub = saveDraft;

export default saveDraft;

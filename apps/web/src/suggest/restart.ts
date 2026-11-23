/**
 * Start a new draft or pull the latest remote version into its workspace.
 *
 * A restart keeps the unsent commits: workspace edits are committed as WIP,
 * the upstream default branch is fetched (the fork is synced best-effort first)
 * and the commits after the last pushed commit are replayed onto it. Pulling
 * latest keeps the current branch and pull request and only refreshes the
 * scoped files from the branch head. Every GitHub, git, registry and workspace
 * operation is injected for unit tests.
 */

import type {
  ProjectRecord,
  ProjectSourceGitHub,
  WorkspaceAdapter,
} from '@opendraft/workspace';
import type { BffSession } from '../github/bff-client';
import { PLACEHOLDER, draftBranch } from './branches';
import { fileDigest, isSuggestionPath } from './file-diff';
import type { SaveConflictResolver, SaveRebaseOptions } from './save';

/** Commit message used for unsent edits when a new draft starts. */
export const RESTART_COMMIT_MESSAGE =
  'WIP: save unsent edits before starting a new draft';

/** A cloned repository branch with its suggestion-scoped files. */
export interface RestartClone {
  /** Head commit SHA of the cloned branch. */
  sha: string;
  /** Repository-relative files of the cloned branch. */
  files: Map<string, string>;
}

/** An opened persistent draft repository. */
export interface RestartRepo {
  /** Project filesystem holding the repository. */
  fs: unknown;
  /** Repository working directory. */
  dir: string;
  /** Currently checked-out branch. */
  branch: string;
}

/** Registry operations needed by {@link restartSuggestion} and {@link pullLatest}. */
export interface RestartRegistry {
  /** Read a project record. */
  get: (id: string) => Promise<ProjectRecord | undefined>;
  /** Replace a project's GitHub source. */
  setSource: (
    id: string,
    source: ProjectSourceGitHub,
  ) => Promise<{ id: string; source: ProjectSourceGitHub }>;
}

/** Injected dependencies of {@link restartSuggestion} and {@link pullLatest}. */
export interface RestartDeps {
  /** Registry used to read and update the project source. */
  registry: RestartRegistry;
  /** Open the workspace of a project id. */
  getWorkspace: (id: string) => Promise<WorkspaceAdapter>;
  /** Open or clone the persistent repository of a project. */
  openRepo: (project: ProjectRecord) => Promise<RestartRepo>;
  /** Commit unsent workspace edits into the repository. */
  commitWorkspace: (projectId: string, message: string) => Promise<string | null>;
  /** Copy repository files back into the editor workspace. */
  checkoutToWorkspace: (projectId: string) => Promise<void>;
  /** Fetch a remote branch through the git relay. */
  fetch: (fs: unknown, dir: string, url: string, branch: string) => Promise<void>;
  /** Resolve the current HEAD commit SHA. */
  headSha: (fs: unknown, dir: string) => Promise<string>;
  /** Read every tracked working-tree file. */
  readWorkingFiles: (fs: unknown, dir: string) => Promise<Map<string, string>>;
  /** Build the relay URL of a repository. */
  relayUrl: (owner: string, repo: string) => string;
  /** Rebase a branch onto another ref, resolving conflicts per path. */
  rebaseOnto: (opts: SaveRebaseOptions) => Promise<{ tip: string; backup: string }>;
  /** Per-file conflict resolver. */
  resolveConflicts: SaveConflictResolver;
  /** Rename the checked-out local branch. */
  renameBranch: (
    fs: unknown,
    dir: string,
    oldName: string,
    newName: string,
  ) => Promise<void>;
  /** Clone a repository, optionally at a branch, through the git relay. */
  clone: (owner: string, repo: string, ref?: string) => Promise<RestartClone>;
  /** Merge the upstream default branch into a target branch. */
  syncFork: (owner: string, repo: string, branch: string) => Promise<void>;
  /** Signed-in viewer whose login names the new draft branch. */
  session: BffSession;
}

/** Result of {@link restartSuggestion} and {@link pullLatest}. */
export interface RestartResult {
  /** Project whose source was reset. */
  projectId: string;
  /** Branch the project now tracks. */
  branch: string;
  /** Commit SHA the workspace files were synced with. */
  sha: string;
}

/**
 * Load the GitHub source of a draft project.
 *
 * @param projectId - Project id to load.
 * @param deps - Injected dependencies.
 * @returns The stored GitHub source.
 * @throws Error when the project is missing or is not backed by GitHub.
 */
async function loadSource(
  projectId: string,
  deps: RestartDeps,
): Promise<ProjectSourceGitHub> {
  const project = await deps.registry.get(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  if (project.source.kind !== 'github') {
    throw new Error(`Project is not a GitHub suggestion: ${projectId}`);
  }
  return project.source;
}

/** Keep only suggestion-scoped files from a repository working tree. */
function scoped(
  files: ReadonlyMap<string, string>,
): Map<string, string> {
  return new Map([...files].filter(([path]) => isSuggestionPath(path)));
}

/**
 * Replace the suggestion-scoped files of a workspace with cloned content.
 *
 * Scoped files that are absent from the clone are deleted; files outside the
 * suggestion scope are left untouched.
 *
 * @param workspace - Project workspace to update.
 * @param files - Repository-relative files of the cloned branch.
 */
async function replaceScopedFiles(
  workspace: WorkspaceAdapter,
  files: ReadonlyMap<string, string>,
): Promise<void> {
  const remote = scoped(files);

  for (const path of await workspace.listAll()) {
    if (isSuggestionPath(path) && !remote.has(path)) {
      await workspace.deleteFile(path);
    }
  }

  for (const [path, content] of remote) {
    await workspace.writeFile(path, content);
  }
}

/**
 * Sync the target default branch into the fork, ignoring every failure.
 *
 * @param source - Stored GitHub source of the draft.
 * @param deps - Injected dependencies.
 */
async function syncBestEffort(
  source: ProjectSourceGitHub,
  deps: RestartDeps,
): Promise<void> {
  try {
    await deps.syncFork(source.owner, source.repo, source.upstream.defaultBranch);
  } catch {
    // A failed sync only means the new draft may be slightly behind.
  }
}

/**
 * Start a new draft from the latest upstream default branch.
 *
 * Unsent edits are committed as WIP, the fork is synced best-effort, and the
 * upstream default branch is fetched. Commits after the last pushed commit are
 * replayed onto it, so accepted history never moves. The local branch becomes
 * the placeholder draft branch, the workspace is refreshed and the source is
 * reset to unpushed with no pull request.
 *
 * @param projectId - Project id of the draft.
 * @param deps - Injected GitHub, git, registry and workspace dependencies.
 * @returns The project id, the new branch and the synced commit SHA.
 */
export async function restartSuggestion(
  projectId: string,
  deps: RestartDeps,
): Promise<RestartResult> {
  const source = await loadSource(projectId, deps);
  const project = await deps.registry.get(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);

  const repo = await deps.openRepo(project);
  await deps.commitWorkspace(projectId, RESTART_COMMIT_MESSAGE);
  await syncBestEffort(source, deps);

  const defaultBranch = source.upstream.defaultBranch;
  const upstreamUrl = deps.relayUrl(source.upstream.owner, source.upstream.repo);
  await deps.fetch(repo.fs, repo.dir, upstreamUrl, defaultBranch);
  await deps.rebaseOnto({
    fs: repo.fs,
    dir: repo.dir,
    branch: repo.branch,
    onto: `origin/${defaultBranch}`,
    from: source.syncedSha,
    resolve: deps.resolveConflicts,
  });

  const sha = await deps.headSha(repo.fs, repo.dir);
  const branch = draftBranch(deps.session.login, PLACEHOLDER);
  if (repo.branch !== branch) {
    await deps.renameBranch(repo.fs, repo.dir, repo.branch, branch);
  }
  await deps.checkoutToWorkspace(projectId);

  const files = scoped(await deps.readWorkingFiles(repo.fs, repo.dir));
  await deps.registry.setSource(projectId, {
    ...source,
    branch,
    pushed: false,
    pullNumber: null,
    syncedSha: sha,
    digest: fileDigest(files),
  });

  return { projectId, branch, sha };
}

/**
 * Pull the latest suggestion branch head into the workspace.
 *
 * The branch and pull request number are kept; only the synced commit and the
 * per-file digest move to the new head.
 *
 * @param projectId - Project id of the suggestion.
 * @param deps - Injected GitHub, git, registry and workspace dependencies.
 * @returns The project id, the kept branch and the synced commit SHA.
 */
export async function pullLatest(
  projectId: string,
  deps: RestartDeps,
): Promise<RestartResult> {
  const source = await loadSource(projectId, deps);
  const cloned = await deps.clone(source.owner, source.repo, source.branch);

  const workspace = await deps.getWorkspace(projectId);
  await replaceScopedFiles(workspace, cloned.files);

  await deps.registry.setSource(projectId, {
    ...source,
    syncedSha: cloned.sha,
    digest: fileDigest(scoped(cloned.files)),
  });

  return { projectId, branch: source.branch, sha: cloned.sha };
}

export default restartSuggestion;

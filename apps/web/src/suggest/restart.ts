/**
 * Restart a suggestion or pull the latest remote version into its workspace.
 *
 * A restart syncs the fork best-effort, clones the upstream default branch and
 * replaces the scoped workspace files, so the viewer begins a new suggestion
 * from the latest upstream content. Pulling latest keeps the current branch and
 * pull request and only refreshes the scoped files from the branch head. Every
 * GitHub, git, registry and workspace operation is injected for unit tests.
 */

import type {
  ProjectRecord,
  ProjectSourceGitHub,
  WorkspaceAdapter,
} from '@opendraft/workspace';
import type { BffSession } from '../github/bff-client';
import { suggestionBranch } from './branches';
import { fileDigest, isSuggestionPath } from './file-diff';

/** A cloned repository branch with its suggestion-scoped files. */
export interface RestartClone {
  /** Head commit SHA of the cloned branch. */
  sha: string;
  /** Repository-relative files of the cloned branch. */
  files: Map<string, string>;
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
  /** Clone a repository, optionally at a branch, through the git relay. */
  clone: (owner: string, repo: string, ref?: string) => Promise<RestartClone>;
  /** Merge the upstream default branch into a target branch. */
  syncFork: (owner: string, repo: string, branch: string) => Promise<void>;
  /** Signed-in viewer whose login names the new suggestion branch. */
  session: BffSession;
  /** Current time, used for the new branch timestamp. */
  now: () => Date;
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
 * Load the GitHub source of a suggestion project.
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
  const remote = new Map(
    [...files].filter(([path]) => isSuggestionPath(path)),
  );

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
 * @param source - Stored GitHub source of the suggestion.
 * @param deps - Injected dependencies.
 */
async function syncBestEffort(
  source: ProjectSourceGitHub,
  deps: RestartDeps,
): Promise<void> {
  try {
    await deps.syncFork(source.owner, source.repo, source.upstream.defaultBranch);
  } catch {
    // A failed sync only means the fresh branch may be slightly behind.
  }
}

/**
 * Start a new suggestion from the latest upstream default branch.
 *
 * The fork is synced best-effort, then the upstream default branch is cloned.
 * The workspace's scoped files are replaced, a new suggestion branch is
 * chosen, and the source is reset to unpushed with no pull request.
 *
 * @param projectId - Project id of the suggestion.
 * @param deps - Injected GitHub, git, registry and workspace dependencies.
 * @returns The project id, the new branch and the synced commit SHA.
 */
export async function restartSuggestion(
  projectId: string,
  deps: RestartDeps,
): Promise<RestartResult> {
  const source = await loadSource(projectId, deps);
  const { owner, repo, defaultBranch } = source.upstream;

  await syncBestEffort(source, deps);
  const cloned = await deps.clone(owner, repo, defaultBranch);

  const workspace = await deps.getWorkspace(projectId);
  await replaceScopedFiles(workspace, cloned.files);

  const branch = suggestionBranch(deps.session.login, deps.now());
  await deps.registry.setSource(projectId, {
    ...source,
    branch,
    pushed: false,
    pullNumber: null,
    syncedSha: cloned.sha,
    digest: fileDigest(cloned.files),
  });

  return { projectId, branch, sha: cloned.sha };
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
    digest: fileDigest(cloned.files),
  });

  return { projectId, branch: source.branch, sha: cloned.sha };
}

export default restartSuggestion;

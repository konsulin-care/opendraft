/**
 * Persistent per-project git repository.
 *
 * Each project owns one isomorphic-git repository in lightning-fs (IndexedDB
 * database `od-git-<projectId>`). A project without a repository is
 * shallow-cloned from its GitHub source; later opens reuse it. The editor
 * workspace stays authoritative and syncs with the repository at save time
 * (`commitWorkspace`) and after a rebase (`checkoutToWorkspace`).
 */

import type {
  ProjectRecord,
  ProjectSourceGitHub,
  WorkspaceAdapter,
} from '@opendraft/workspace';
import { isSuggestionPath } from './file-diff';

/** Repository working directory inside the project filesystem. */
export const PROJECT_REPO_DIR = '/repo';

/** Options for cloning a project's source repository. */
export interface ProjectRepoCloneOptions {
  /** Repository owner login. */
  owner: string;
  /** Repository name. */
  repo: string;
  /** Branch to clone; omitted means the remote default branch. */
  ref?: string;
}

/** Options for committing workspace changes into the repository. */
export interface ProjectRepoCommitOptions {
  /** Scoped paths to write or delete (null deletes). */
  changes: Map<string, string | null>;
  /** Commit message. */
  message: string;
}

/** An opened project repository. */
export interface ProjectRepo {
  /** Project that owns the repository. */
  projectId: string;
  /** Persistent isomorphic-git filesystem. */
  fs: unknown;
  /** Repository working directory. */
  dir: string;
  /** Currently checked-out branch. */
  branch: string;
  /** Current HEAD commit SHA. */
  sha: string;
  /** Whether this open shallow-cloned the repository. */
  cloned: boolean;
}

/** Injected dependencies of the project repository operations. */
export interface ProjectRepoDeps {
  /** Open the project's editor workspace. */
  getWorkspace: (id: string) => Promise<WorkspaceAdapter>;
  /** Open the project's persistent IndexedDB filesystem. */
  openFs: (projectId: string) => unknown | Promise<unknown>;
  /** Whether the filesystem already contains a repository with a HEAD. */
  repoExists: (fs: unknown, dir: string) => Promise<boolean>;
  /** Read the currently checked-out branch. */
  currentBranch: (fs: unknown, dir: string) => Promise<string>;
  /** Resolve the current HEAD commit SHA. */
  headSha: (fs: unknown, dir: string) => Promise<string>;
  /** Shallow-clone the source repository into the filesystem. */
  clone: (
    fs: unknown,
    dir: string,
    opts: ProjectRepoCloneOptions,
  ) => Promise<{ sha: string; branch: string }>;
  /** Read every tracked working-tree file as UTF-8 text. */
  readWorkingFiles: (fs: unknown, dir: string) => Promise<Map<string, string>>;
  /** Write and stage changes, then commit; returns null when nothing changed. */
  commitFiles: (
    fs: unknown,
    dir: string,
    opts: ProjectRepoCommitOptions,
  ) => Promise<string | null>;
}

/** Opened repositories keyed by project id, with the deps that opened them. */
const OPEN_REPOS = new Map<
  string,
  { repo: ProjectRepo; deps: ProjectRepoDeps }
>();

/**
 * Narrow a project source to GitHub or explain why the project has no repo.
 *
 * @param project - Project record to inspect.
 * @returns The GitHub source of the project.
 * @throws Error when the project is not backed by GitHub.
 */
function githubSource(project: ProjectRecord): ProjectSourceGitHub {
  if (project.source.kind !== 'github') {
    throw new Error(`Project is not a GitHub project: ${project.id}`);
  }
  return project.source;
}

/**
 * Keep only suggestion-scoped files.
 *
 * @param files - Map of repository-relative path to content.
 * @returns A new map containing only scoped paths.
 */
function scoped(files: ReadonlyMap<string, string>): Map<string, string> {
  return new Map([...files].filter(([path]) => isSuggestionPath(path)));
}

/**
 * Read the suggestion-scoped files of a workspace.
 *
 * @param workspace - Project workspace.
 * @returns Map of repository-relative path to content.
 */
async function readWorkspaceFiles(
  workspace: WorkspaceAdapter,
): Promise<Map<string, string>> {
  const files = new Map<string, string>();

  for (const path of await workspace.listAll()) {
    if (!isSuggestionPath(path)) continue;
    const content = await workspace.readFile(path);
    if (content !== null) files.set(path, content);
  }

  return files;
}

/**
 * Build the changes that make the repository match the workspace.
 *
 * Changed or new workspace files are written; scoped repository files missing
 * from the workspace are deleted. Unchanged files are never staged.
 *
 * @param local - Scoped workspace files.
 * @param remote - Scoped repository working-tree files.
 * @returns Paths to write (content) or delete (null).
 */
function workspaceChanges(
  local: ReadonlyMap<string, string>,
  remote: ReadonlyMap<string, string>,
): Map<string, string | null> {
  const changes = new Map<string, string | null>();

  for (const [path, content] of local) {
    if (remote.get(path) !== content) changes.set(path, content);
  }
  for (const path of remote.keys()) {
    if (!local.has(path)) changes.set(path, null);
  }

  return changes;
}

/**
 * Look up an opened repository, optionally replacing its dependencies.
 *
 * @param projectId - Project id.
 * @param deps - Optional dependencies refresh.
 * @returns The opened repository and the dependencies to use.
 * @throws Error when the project repository has not been opened.
 */
function openedRepo(
  projectId: string,
  deps?: ProjectRepoDeps,
): { repo: ProjectRepo; deps: ProjectRepoDeps } {
  const opened = OPEN_REPOS.get(projectId);
  if (!opened) {
    throw new Error(`Project repository is not open: ${projectId}`);
  }
  if (deps) opened.deps = deps;
  return opened;
}

/**
 * Open the persistent project repository, cloning it on first use.
 *
 * Existing projects are a migration case: when their filesystem has no
 * repository yet, the source is shallow-cloned at the pushed branch, or at the
 * upstream default branch when the draft has never been pushed. An existing
 * repository is reused as-is.
 *
 * @param project - Project record with a GitHub source.
 * @param deps - Injected filesystem, git and workspace operations.
 * @returns The opened repository handle.
 */
export async function openProjectRepo(
  project: ProjectRecord,
  deps: ProjectRepoDeps,
): Promise<ProjectRepo> {
  const source = githubSource(project);
  const fs = await deps.openFs(project.id);
  const exists = await deps.repoExists(fs, PROJECT_REPO_DIR);

  if (!exists) {
    const ref = source.pushed ? source.branch : source.upstream.defaultBranch;
    const cloned = await deps.clone(fs, PROJECT_REPO_DIR, {
      owner: source.owner,
      repo: source.repo,
      ref,
    });
    const repo: ProjectRepo = {
      projectId: project.id,
      fs,
      dir: PROJECT_REPO_DIR,
      branch: cloned.branch || ref,
      sha: cloned.sha,
      cloned: true,
    };
    OPEN_REPOS.set(project.id, { repo, deps });
    return repo;
  }

  const branch = await deps.currentBranch(fs, PROJECT_REPO_DIR);
  const repo: ProjectRepo = {
    projectId: project.id,
    fs,
    dir: PROJECT_REPO_DIR,
    branch: branch || source.branch,
    sha: await deps.headSha(fs, PROJECT_REPO_DIR),
    cloned: false,
  };
  OPEN_REPOS.set(project.id, { repo, deps });
  return repo;
}

/**
 * Copy workspace edits into the repository worktree and commit differences.
 *
 * Only `opendraft.yml` and `manuscripts/**` are considered. A save with no
 * difference returns null without creating a commit.
 *
 * @param projectId - Project id whose repository was opened.
 * @param message - Commit message.
 * @param deps - Optional dependency refresh for the opened repository.
 * @returns The new commit SHA, or null when nothing changed.
 */
export async function commitWorkspace(
  projectId: string,
  message: string,
  deps?: ProjectRepoDeps,
): Promise<string | null> {
  const opened = openedRepo(projectId, deps);
  const workspace = await opened.deps.getWorkspace(projectId);
  const local = await readWorkspaceFiles(workspace);
  const remote = scoped(
    await opened.deps.readWorkingFiles(opened.repo.fs, opened.repo.dir),
  );
  const changes = workspaceChanges(local, remote);

  if (changes.size === 0) return null;

  const sha = await opened.deps.commitFiles(
    opened.repo.fs,
    opened.repo.dir,
    { changes, message },
  );
  if (sha) opened.repo.sha = sha;
  return sha;
}

/**
 * Write the repository's scoped files back into the editor workspace.
 *
 * Scoped workspace files that no longer exist in the repository are deleted;
 * files outside the suggestion scope are left untouched.
 *
 * @param projectId - Project id whose repository was opened.
 * @param deps - Optional dependency refresh for the opened repository.
 * @returns A promise that resolves after the workspace is synchronised.
 */
export async function checkoutToWorkspace(
  projectId: string,
  deps?: ProjectRepoDeps,
): Promise<void> {
  const opened = openedRepo(projectId, deps);
  const remote = scoped(
    await opened.deps.readWorkingFiles(opened.repo.fs, opened.repo.dir),
  );
  const workspace = await opened.deps.getWorkspace(projectId);

  for (const path of await workspace.listAll()) {
    if (isSuggestionPath(path) && !remote.has(path)) {
      await workspace.deleteFile(path);
    }
  }
  for (const [path, content] of remote) {
    await workspace.writeFile(path, content);
  }
}

export default openProjectRepo;

/**
 * Public types of the persistent per-project git repository.
 *
 * Kept in a separate module so `project-repo.ts` stays within the file size
 * limit; the implementation re-exports every type for stable imports.
 */

import type { WorkspaceAdapter } from '@opendraft/workspace';

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
  /** Ensure a branch exists and is checked out, for unpushed drafts. */
  ensureBranch?: (fs: unknown, dir: string, branch: string) => Promise<void>;
  /** Read every tracked working-tree file as UTF-8 text. */
  readWorkingFiles: (fs: unknown, dir: string) => Promise<Map<string, string>>;
  /** Write and stage changes, then commit; returns null when nothing changed. */
  commitFiles: (
    fs: unknown,
    dir: string,
    opts: ProjectRepoCommitOptions,
  ) => Promise<string | null>;
}

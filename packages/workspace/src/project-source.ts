/** A local, on-disk project source. */
export interface ProjectSourceLocal {
  kind: 'local';
}

/** Upstream repository a GitHub project was cloned from. */
export interface ProjectUpstream {
  /** Upstream repository owner (login or organization). */
  owner: string;
  /** Upstream repository name. */
  repo: string;
  /** Upstream default branch, used as the pull request base. */
  defaultBranch: string;
}

/** A GitHub-hosted project source. */
export interface ProjectSourceGitHub {
  kind: 'github';
  /** Owner of the push-target repository (the fork for non-writers). */
  owner: string;
  /** Name of the push-target repository. */
  repo: string;
  /** Branch we push to: on the fork (non-writers) or upstream (writers). */
  branch: string;
  /** Upstream repository the project was forked from. */
  upstream: ProjectUpstream;
  /** Whether the upstream repository is private. */
  private: boolean;
  /** Whether the current branch has been pushed to the remote. */
  pushed: boolean;
  /** Remote commit SHA the local files were last synced with. */
  syncedSha: string;
  /** Per-file content digest at sync time, used to detect local edits. */
  digest: Record<string, string>;
  /** Number of the open pull request, or null when none was opened. */
  pullNumber: number | null;
}

/** Where a project's files come from. */
export type ProjectSource = ProjectSourceLocal | ProjectSourceGitHub;

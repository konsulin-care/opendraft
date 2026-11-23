/**
 * Import a suggestion into the editor project list.
 *
 * A suggestion project is backed by a GitHub branch. Only the files that are
 * part of a suggestion (`opendraft.yml` and `manuscripts/**`) are written into
 * the project workspace, and the project source records the branch, the commit
 * it was synced with, and a per-file digest used to detect local edits.
 */

import type { WorkspaceAdapter } from '@opendraft/workspace';
import type {
  ProjectSourceGitHub,
  ProjectUpstream,
} from '@opendraft/workspace';
import { fileDigest, isSuggestionPath } from './file-diff';

/** A repository owner and name. */
export interface SuggestionRepoRef {
  /** Repository owner login. */
  owner: string;
  /** Repository name. */
  repo: string;
}

/** Input of {@link importIntoProject}. */
export interface ImportIntoProjectInput {
  /** Human-readable project name. */
  name: string;
  /** Repository-relative files cloned from the suggestion branch. */
  files: ReadonlyMap<string, string>;
  /** Upstream repository the suggestion targets. */
  upstream: ProjectUpstream;
  /** Repository that owns the suggestion branch (fork or upstream). */
  target: SuggestionRepoRef;
  /** Suggestion branch name. */
  branch: string;
  /** Commit SHA the cloned files were synced with. */
  syncedSha: string;
  /** Whether the upstream repository is private. */
  private: boolean;
  /** Whether the branch has been pushed to the remote. */
  pushed: boolean;
  /** Open pull request number, or null when none exists. */
  pullNumber: number | null;
}

/** Registry operations needed by {@link importIntoProject}. */
export interface ImportRegistry {
  /** Create a project record. */
  create: (
    name: string,
    source?: ProjectSourceGitHub,
  ) => Promise<{ id: string }>;
  /** Replace a project's source. */
  setSource: (
    id: string,
    source: ProjectSourceGitHub,
  ) => Promise<{ id: string; source: ProjectSourceGitHub }>;
}

/** Injected dependencies of {@link importIntoProject}. */
export interface ImportIntoProjectDeps {
  /** Project registry used to register and update the project. */
  registry: ImportRegistry;
  /** Open the workspace of a project id. */
  getWorkspace: (id: string) => Promise<WorkspaceAdapter>;
}

/** Result of {@link importIntoProject}. */
export interface ImportIntoProjectResult {
  /** Id of the created project. */
  projectId: string;
  /** Source stored on the project record. */
  source: ProjectSourceGitHub;
}

/**
 * Build the GitHub project source for a suggestion.
 *
 * @param input - Suggestion branch and repository details.
 * @returns A source record describing the push target and sync state.
 */
function buildSource(input: ImportIntoProjectInput): ProjectSourceGitHub {
  return {
    kind: 'github',
    owner: input.target.owner,
    repo: input.target.repo,
    branch: input.branch,
    upstream: input.upstream,
    private: input.private,
    pushed: input.pushed,
    syncedSha: input.syncedSha,
    digest: fileDigest(input.files),
    pullNumber: input.pullNumber,
  };
}

/**
 * Create a project, write its suggestion files and store the GitHub source.
 *
 * Files outside the suggestion scope are skipped, so a checkout that contains
 * extra repository content never leaks into the editor project.
 *
 * @param input - Suggestion branch, files and source metadata.
 * @param deps - Injected registry and workspace access.
 * @returns The created project id and its stored source.
 */
export async function importIntoProject(
  input: ImportIntoProjectInput,
  deps: ImportIntoProjectDeps,
): Promise<ImportIntoProjectResult> {
  const source = buildSource(input);
  const record = await deps.registry.create(input.name);
  const workspace = await deps.getWorkspace(record.id);

  for (const [path, content] of input.files) {
    if (isSuggestionPath(path)) {
      await workspace.writeFile(path, content);
    }
  }

  await deps.registry.setSource(record.id, source);
  return { projectId: record.id, source };
}

export default importIntoProject;

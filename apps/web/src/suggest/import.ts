/**
 * Import a suggestion into the editor project list.
 *
 * A suggestion project is backed by a GitHub branch and its own persistent
 * repository. Only the files that are part of a suggestion (`opendraft.yml`
 * and `manuscripts/**`) are written into the project workspace, and the project
 * source records the branch, the commit it was synced with, and a per-file
 * digest used to detect local edits.
 */

import type {
  ProjectRecord,
  ProjectSourceGitHub,
  ProjectUpstream,
  WorkspaceAdapter,
} from '@opendraft/workspace';
import type { BffSession } from '../github/bff-client';
import { fileDigest, isSuggestionPath } from './file-diff';

/** A repository owner and name. */
export interface SuggestionRepoRef {
  /** Repository owner login. */
  owner: string;
  /** Repository name. */
  repo: string;
}

/** A project repository prepared for drafting. */
export interface PreparedDraftRepo {
  /** Head commit SHA of the checked-out branch. */
  sha: string;
  /** Branch now checked out in the persistent repository. */
  branch: string;
  /** Repository-relative working files of the branch. */
  files: Map<string, string>;
}

/** Input of {@link importIntoProject}. */
export interface ImportIntoProjectInput {
  /** Human-readable project name. */
  name: string;
  /** Upstream repository the suggestion targets. */
  upstream: ProjectUpstream;
  /** Repository that owns the suggestion branch (fork or upstream). */
  target: SuggestionRepoRef;
  /** Suggestion branch name. */
  branch: string;
  /** Whether the upstream repository is private. */
  private: boolean;
  /** Whether the branch has been pushed to the remote. */
  pushed: boolean;
  /** Open pull request number, or null when none exists. */
  pullNumber: number | null;
  /** Signed-in viewer who owns the draft repository. */
  session: BffSession;
}

/** Registry operations needed by {@link importIntoProject}. */
export interface ImportRegistry {
  /** Create a project record. */
  create: (
    name: string,
    source?: ProjectSourceGitHub,
  ) => Promise<ProjectRecord>;
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
  /**
   * Clone or reuse the project's persistent repository and check out the
   * draft branch. A fresh draft creates the local branch from the cloned
   * default branch; a resume checks the existing remote branch out.
   */
  prepareRepo: (
    project: ProjectRecord,
    branch: string,
    createBranch: boolean,
    session: BffSession,
  ) => Promise<PreparedDraftRepo>;
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
 * @param syncedSha - Commit SHA the repository is currently synced with.
 * @param files - Repository files used for the per-file digest.
 * @returns A source record describing the push target and sync state.
 */
function buildSource(
  input: ImportIntoProjectInput,
  syncedSha: string,
  files: ReadonlyMap<string, string>,
): ProjectSourceGitHub {
  return {
    kind: 'github',
    owner: input.target.owner,
    repo: input.target.repo,
    branch: input.branch,
    upstream: input.upstream,
    private: input.private,
    pushed: input.pushed,
    syncedSha,
    digest: fileDigest(files),
    pullNumber: input.pullNumber,
  };
}

/**
 * Write the suggestion-scoped repository files into a project workspace.
 *
 * Files outside the suggestion scope are skipped, so a checkout that contains
 * extra repository content never leaks into the editor project.
 *
 * @param workspace - Project workspace to fill.
 * @param files - Repository working files.
 * @returns A promise that resolves after every scoped file is written.
 */
async function writeScopedFiles(
  workspace: WorkspaceAdapter,
  files: ReadonlyMap<string, string>,
): Promise<void> {
  for (const [path, content] of files) {
    if (isSuggestionPath(path)) {
      await workspace.writeFile(path, content);
    }
  }
}

/**
 * Create a project, prepare its persistent repository and store the source.
 *
 * @param input - Suggestion branch, target repository and source metadata.
 * @param deps - Injected registry, workspace and repository access.
 * @returns The created project id and its stored source.
 */
export async function importIntoProject(
  input: ImportIntoProjectInput,
  deps: ImportIntoProjectDeps,
): Promise<ImportIntoProjectResult> {
  const initial = buildSource(input, '', new Map());
  const record = await deps.registry.create(input.name, initial);
  const prepared = await deps.prepareRepo(
    record,
    input.branch,
    !input.pushed,
    input.session,
  );
  const workspace = await deps.getWorkspace(record.id);
  await writeScopedFiles(workspace, prepared.files);

  const source = buildSource(input, prepared.sha, prepared.files);
  await deps.registry.setSource(record.id, source);
  return { projectId: record.id, source };
}

export default importIntoProject;

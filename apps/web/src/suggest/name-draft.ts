/**
 * Name a draft and move its local branch to the matching remote-safe name.
 *
 * A draft branch is named lazily at first save. The name is checked against the
 * target repository's remote refs so two drafts never share a branch, and the
 * local branch is only renamed while the draft has never been pushed.
 */

import type { ProjectRecord, ProjectSourceGitHub } from '@opendraft/workspace';
import {
  draftBranch,
  draftNameStatus,
  draftPrefix,
  draftSlug,
  type DraftNameStatus,
} from './branches';

/** A remote ref returned by the injected ref listing. */
export interface DraftNameRemoteRef {
  /** Branch or ref name. */
  name: string;
}

/** Input of {@link checkDraftName}. */
export interface CheckDraftNameInput {
  /** Owner of the target repository. */
  owner: string;
  /** Name of the target repository. */
  repo: string;
  /** GitHub login of the draft author. */
  login: string;
  /** Human readable draft name. */
  name: string;
}

/** Injected dependencies of {@link checkDraftName}. */
export interface CheckDraftNameDeps {
  /**
   * List remote refs of a repository whose name starts with a prefix.
   *
   * The browser wires this to `listSuggestionBranches` or `listServerRefs`.
   */
  listRefs: (
    owner: string,
    repo: string,
    prefix: string,
  ) => Promise<DraftNameRemoteRef[]>;
}

/** Registry operations needed by {@link applyDraftName}. */
export interface DraftNameRegistry {
  /** Read a project record. */
  get: (id: string) => Promise<ProjectRecord | undefined>;
  /** Replace a project's source. */
  setSource: (
    id: string,
    source: ProjectSourceGitHub,
  ) => Promise<{ id: string; source: ProjectSourceGitHub }>;
}

/** Local repository operations needed by {@link applyDraftName}. */
export interface DraftNameRepo {
  /** Rename a local branch, moving HEAD when it is checked out. */
  renameBranch: (oldName: string, newName: string) => Promise<void>;
}

/** Injected dependencies of {@link applyDraftName}. */
export interface ApplyDraftNameDeps {
  /** Registry used to read and update the project source. */
  registry: DraftNameRegistry;
  /** Opened local repository of the project. */
  repo: DraftNameRepo;
  /** GitHub login of the draft author. */
  login: string;
}

/**
 * Check whether a draft name is available on the target repository.
 *
 * Remote refs under `od-<login>` are listed so a taken slug reports the next
 * free numbered alternative and a branch named exactly `od-<login>` blocks
 * drafting. The check is read-only.
 *
 * @param input - Target repository, viewer login and draft name.
 * @param deps - Injected remote ref listing.
 * @returns Free, taken with an alternative slug, or blocked.
 */
export async function checkDraftName(
  input: CheckDraftNameInput,
  deps: CheckDraftNameDeps,
): Promise<DraftNameStatus> {
  const prefix = draftPrefix(input.login).replace(/\/$/, '');
  const refs = await deps.listRefs(input.owner, input.repo, prefix);
  return draftNameStatus(
    refs.map((ref) => ref.name),
    input.login,
    draftSlug(input.name),
  );
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
  deps: ApplyDraftNameDeps,
): Promise<ProjectSourceGitHub> {
  const project = await deps.registry.get(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  if (project.source.kind !== 'github') {
    throw new Error(`Project is not a GitHub project: ${projectId}`);
  }
  return project.source;
}

/**
 * Rename the local draft branch and record the name in the project source.
 *
 * Renaming is only allowed while the draft has never been pushed: once the
 * branch exists remotely the name is fixed so the pull request keeps working.
 *
 * @param projectId - Project id of the draft.
 * @param name - Human readable draft name.
 * @param deps - Injected registry, local repository and viewer login.
 * @returns The new local branch name.
 * @throws Error when the project is missing, not on GitHub, or already pushed.
 */
export async function applyDraftName(
  projectId: string,
  name: string,
  deps: ApplyDraftNameDeps,
): Promise<string> {
  const source = await loadSource(projectId, deps);
  if (source.pushed) {
    throw new Error(`Draft is already pushed: ${source.branch}`);
  }

  const branch = draftBranch(deps.login, name);
  await deps.repo.renameBranch(source.branch, branch);
  await deps.registry.setSource(projectId, { ...source, branch });
  return branch;
}

export default applyDraftName;

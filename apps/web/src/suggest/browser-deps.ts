/**
 * Browser wiring for the suggestion flow.
 *
 * Every factory lazily loads the git implementation, its Buffer polyfill and
 * the isomorphic-git HTTP client, so the reader path never pays for git until
 * a suggestion actually starts. GitHub, registry and workspace operations are
 * bound to the BFF client, the suggestion client, the shared project registry
 * and the shared workspace manager.
 */

import { workspaceManager } from '@opendraft/workspace';
import type { ProjectSourceGitHub } from '@opendraft/workspace';
import type {
  BffSession,
  ForkResult,
  PullRequestInput,
  PullRequestResult,
} from '../github/bff-client';
import { createPullRequest, forkRepo } from '../github/bff-client';
import {
  deleteSuggestionBranch,
  findSuggestionPull as fetchSuggestionPull,
  listSuggestionBranches as fetchSuggestionBranches,
  syncFork,
} from '../github/bff-suggest';
import type { SuggestionBranch, SuggestionPull } from '../github/bff-suggest';
import { projectRegistry } from '../hooks/useProjects';
import { sweepBranches } from './cleanup-branches';
import type { SweepDeps } from './cleanup-branches';
import { applyDraftName } from './name-draft';
import { openProjectRepo } from './project-repo';
import {
  createProjectRepoDeps,
  createRestartBrowserDeps,
  createSaveDeps,
  prepareProjectDraft,
} from './repo-deps';
import type { CheckSuggestionDeps } from './status';
import type { RestartDeps } from './restart';
import type { StartSuggestionDeps } from './start';

export { createSaveDeps };
import type { SendSuggestionDeps, SubmitDeps } from './submit';

type GitModule = typeof import('@opendraft/git');
type GitRemoteOptions = ConstructorParameters<GitModule['RemoteGit']>[0];
type GitHttp = GitRemoteOptions['http'];
type GitFs = Parameters<GitModule['commitFilesOnBranch']>[0];

/** Loaded git implementation and its HTTP client. */
interface BrowserGit {
  /** Isomorphic-git wrapper exports. */
  git: GitModule;
  /** HTTP client used by the git remote. */
  http: GitHttp;
}

/**
 * Load the Buffer polyfill, git implementation and isomorphic-git HTTP client.
 *
 * @returns The git module and its HTTP client.
 */
async function loadGit(): Promise<BrowserGit> {
  await import('../github/buffer-polyfill');
  const git = await import('@opendraft/git');
  const http = (
    await import('../../../../packages/git/node_modules/isomorphic-git/http/web/index.js')
  ).default;
  return { git, http };
}

/**
 * Open the workspace of a project through the shared workspace manager.
 *
 * @param id - Project id.
 * @returns The project workspace.
 */
function getWorkspace(id: string) {
  return workspaceManager.get(id);
}

/**
 * Build registry operations that narrow the stored source to GitHub.
 *
 * @returns Registry operations used by the suggestion modules.
 */
function projectStore() {
  return {
    list: () => projectRegistry.list(),
    create: (name: string, source?: ProjectSourceGitHub) =>
      projectRegistry.create(name, source),
    get: (id: string) => projectRegistry.get(id),
    setSource: async (id: string, source: ProjectSourceGitHub) => {
      const updated = await projectRegistry.setSource(id, source);
      return { id: updated.id, source };
    },
  };
}

/**
 * Build the list of suggestion branches of a repository.
 *
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param prefix - Branch prefix, e.g. `opendraft/ada/`.
 * @returns Matching branch names with their head SHA.
 */
function listSuggestionBranches(
  owner: string,
  repo: string,
  prefix: string,
): Promise<SuggestionBranch[]> {
  return fetchSuggestionBranches(owner, repo, prefix);
}

/**
 * Find the pull request whose head matches a suggestion branch.
 *
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param head - Head ref, optionally `owner:branch`.
 * @returns The matching pull request, or null when none exists.
 */
function findSuggestionPull(
  owner: string,
  repo: string,
  head: string,
): Promise<SuggestionPull | null> {
  return fetchSuggestionPull(owner, repo, head);
}

/**
 * Fork a repository into the signed-in viewer's account.
 *
 * @param owner - Upstream repository owner login.
 * @param repo - Upstream repository name.
 * @returns Owner, name and default branch of the fork.
 */
function forkRepository(owner: string, repo: string): Promise<ForkResult> {
  return forkRepo(owner, repo);
}

/**
 * Open a pull request between a head and a base branch.
 *
 * @param owner - Upstream repository owner login.
 * @param repo - Upstream repository name.
 * @param input - Title, head, base and body of the pull request.
 * @returns Pull request number and browser URL.
 */
function createPull(
  owner: string,
  repo: string,
  input: PullRequestInput,
): Promise<PullRequestResult> {
  return createPullRequest(owner, repo, input);
}

/**
 * Build the dependencies of {@link startSuggestion} for the browser.
 *
 * @returns Registry, GitHub, persistent repository and branch dependencies.
 */
export async function createStartDeps(): Promise<StartSuggestionDeps> {
  return {
    registry: projectStore(),
    getWorkspace,
    forkRepo: forkRepository,
    syncFork: (owner, repo, branch) => syncFork(owner, repo, branch),
    listSuggestionBranches,
    findSuggestionPull,
    prepareRepo: prepareProjectDraft,
  };
}

/**
 * Rename a draft's local branch and store its new name.
 *
 * @param projectId - Project id of the draft.
 * @param name - Human readable draft name.
 * @param session - Signed-in viewer naming the draft.
 * @returns The new local draft branch name.
 */
async function applyDraftNameFor(
  projectId: string,
  name: string,
  session: BffSession,
): Promise<string> {
  const [deps, project, browser] = await Promise.all([
    createProjectRepoDeps(session),
    projectRegistry.get(projectId),
    loadGit(),
  ]);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  const repo = await openProjectRepo(project, deps);
  const local = new browser.git.LocalRepo(repo.fs as GitFs, repo.dir);
  return applyDraftName(projectId, name, {
    registry: projectStore(),
    login: session.login,
    repo: {
      renameBranch: (oldName, newName) =>
        local.renameBranch(oldName, newName),
    },
  });
}

/**
 * Build the dependencies of {@link submitSuggestion} for the browser.
 *
 * @param session - Signed-in viewer used as the commit author.
 * @returns Save dependencies plus draft naming and pull request operations.
 */
export async function createSubmitDeps(
  session: BffSession,
): Promise<SubmitDeps & SendSuggestionDeps> {
  const save = await createSaveDeps(session);
  return {
    ...save,
    applyName: (projectId, name) =>
      applyDraftNameFor(projectId, name, session),
    findSuggestionPull,
    createPullRequest: createPull,
  };
}

/**
 * Build the dependencies of {@link checkSuggestion} for the browser.
 *
 * Status checks only read GitHub state, so they never load the git bundle.
 *
 * @returns Branch listing and pull request lookup dependencies.
 */
export async function createCheckDeps(): Promise<CheckSuggestionDeps> {
  return { listSuggestionBranches, findSuggestionPull };
}

/**
 * Sweep the signed-in viewer's stale remote draft branches.
 *
 * @param source - Repository and current branch of the draft.
 * @param session - Signed-in viewer whose branch prefixes are swept.
 * @returns The deleted and kept branch names.
 */
export async function sweepOwnBranches(
  source: ProjectSourceGitHub,
  session: BffSession,
): Promise<unknown> {
  const deps: SweepDeps = {
    listSuggestionBranches,
    findSuggestionPull,
    deleteBranch: deleteSuggestionBranch,
  };
  return sweepBranches(source, session.login, deps);
}

/**
 * Build the dependencies of {@link restartSuggestion} and {@link pullLatest}.
 *
 * @param session - Signed-in viewer whose login names the new branch.
 * @returns Registry, GitHub, git and clock dependencies.
 */
export async function createRestartDeps(session: BffSession): Promise<RestartDeps> {
  return {
    ...(await createRestartBrowserDeps(session)),
    sweepBranches: (source) => sweepOwnBranches(source, session),
  };
}

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
  findSuggestionPull as fetchSuggestionPull,
  listSuggestionBranches as fetchSuggestionBranches,
  syncFork,
} from '../github/bff-suggest';
import type { SuggestionBranch, SuggestionPull } from '../github/bff-suggest';
import { projectRegistry } from '../hooks/useProjects';
import { isSuggestionPath } from './file-diff';
import { prepareProjectDraft } from './repo-deps';
import type { CheckSuggestionDeps } from './status';
import type { RestartDeps } from './restart';
import type { SaveDeps } from './save';
import type { StartSuggestionDeps } from './start';
import type { SubmitDeps } from './submit';

type GitModule = typeof import('@opendraft/git');
type GitRemoteOptions = ConstructorParameters<GitModule['RemoteGit']>[0];
type GitHttp = GitRemoteOptions['http'];
type GitFs = Parameters<GitModule['commitFilesOnBranch']>[0];

/** A cloned repository with its head SHA and suggestion-scoped files. */
interface BrowserClone {
  /** Head commit SHA of the cloned branch. */
  sha: string;
  /** Git filesystem client used by the commit and push helpers. */
  fs: unknown;
  /** Repository working directory. */
  dir: string;
  /** Suggestion-scoped repository files. */
  files: Map<string, string>;
}

/** Loaded git implementation and its HTTP client. */
interface BrowserGit {
  /** Isomorphic-git wrapper exports. */
  git: GitModule;
  /** HTTP client used by the git remote. */
  http: GitHttp;
}

/** Keep only the files a suggestion may read or write. */
function suggestionFiles(files: Map<string, string>): Map<string, string> {
  return new Map([...files].filter(([path]) => isSuggestionPath(path)));
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
 * Clone a repository through the BFF git relay and read its working files.
 *
 * @param browser - Loaded git implementation and HTTP client.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param ref - Optional branch to check out.
 * @returns Head SHA, git filesystem, working directory and scoped files.
 */
async function cloneRepo(
  browser: BrowserGit,
  owner: string,
  repo: string,
  ref?: string,
): Promise<BrowserClone> {
  const { git, http } = browser;
  const remote = new git.RemoteGit({ http });
  const url = git.relayUrl(window.location.origin, owner, repo);
  const cloned = await remote.clone(url, ref);
  const files = suggestionFiles(
    await git.readWorkingFiles(remote.fs as GitFs, remote.dir),
  );
  return { sha: cloned.sha, fs: remote.fs, dir: remote.dir, files };
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
 * Build the dependencies of {@link saveToCopy} for the browser.
 *
 * @param session - Signed-in viewer used as the commit author.
 * @returns Registry, git, relay and workspace dependencies.
 */
export async function createSaveDeps(session: BffSession): Promise<SaveDeps> {
  const browser = await loadGit();
  const { git, http } = browser;

  return {
    registry: projectStore(),
    getWorkspace,
    clone: (owner, repo, ref) => cloneRepo(browser, owner, repo, ref),
    relayUrl: (owner, repo) => git.relayUrl(window.location.origin, owner, repo),
    readWorkingFiles: async (fs, dir) =>
      suggestionFiles(await git.readWorkingFiles(fs as GitFs, dir)),
    commitFilesOnBranch: (fs, dir, opts) =>
      git.commitFilesOnBranch(fs as GitFs, dir, opts),
    push: async (fs, dir, url, branch) => {
      const remote = new git.RemoteGit({
        http,
        fs: fs as GitRemoteOptions['fs'],
        dir,
      });
      await remote.push(url, branch);
    },
    session,
  };
}

/**
 * Build the dependencies of {@link submitSuggestion} for the browser.
 *
 * @param session - Signed-in viewer used as the commit author.
 * @returns Save dependencies plus pull request lookup and creation.
 */
export async function createSubmitDeps(session: BffSession): Promise<SubmitDeps> {
  const save = await createSaveDeps(session);
  return {
    ...save,
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
 * Build the dependencies of {@link restartSuggestion} and {@link pullLatest}.
 *
 * @param session - Signed-in viewer whose login names the new branch.
 * @returns Registry, GitHub, git and clock dependencies.
 */
export async function createRestartDeps(session: BffSession): Promise<RestartDeps> {
  const browser = await loadGit();
  return {
    registry: projectStore(),
    getWorkspace,
    clone: (owner, repo, ref) => cloneRepo(browser, owner, repo, ref),
    syncFork: (owner, repo, branch) => syncFork(owner, repo, branch),
    session,
    now: () => new Date(),
  };
}

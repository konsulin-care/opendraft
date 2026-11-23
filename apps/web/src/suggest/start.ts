/**
 * Start or resume a suggestion: existing local project, latest open remote
 * branch, then a fresh clone from the default branch.
 */

import type { WorkspaceAdapter, ProjectRecord } from '@opendraft/workspace';
import type { BffSession, ForkResult, RepoPermissions } from '../github/bff-client';
import type { SuggestionBranch, SuggestionPull } from '../github/bff-suggest';
import { latestBranch, suggestionBranch, suggestionPrefix } from './branches';
import { importIntoProject } from './import';
import type { ImportRegistry, SuggestionRepoRef } from './import';

/** Number of clone attempts while a freshly created fork becomes ready. */
const FORK_CLONE_ATTEMPTS = 5;

/** Delay between fork clone attempts, in milliseconds. */
const FORK_CLONE_RETRY_DELAY_MS = 2000;

/** Where a suggestion branch lives: on the upstream or on a fork. */
export type SuggestionPlan = 'branch' | 'fork';

/** How the suggestion was resumed. */
export type SuggestionResume = 'local' | 'remote' | 'fresh';

/** Repository the suggestion starts from. */
export interface StartSuggestionUpstream {
  /** Upstream repository owner login. */
  owner: string;
  /** Upstream repository name. */
  repo: string;
}

/** Input of {@link startSuggestion}. */
export interface StartSuggestionInput {
  /** Repository opened in the reader. */
  upstream: StartSuggestionUpstream;
  /** Signed-in viewer who owns the suggestion. */
  session: BffSession;
  /** Whether the branch lives on the upstream or on a fork. */
  plan: SuggestionPlan;
  /** Repository permissions, installation state and default branch. */
  access: RepoPermissions;
}

/** A repository with the default branch a fresh clone starts from. */
export interface SuggestionTarget extends SuggestionRepoRef {
  /** Default branch of the target repository. */
  defaultBranch: string;
}

/** A cloned suggestion branch. */
export interface ClonedSuggestion {
  /** Head commit SHA of the cloned branch. */
  sha: string;
  /** Repository-relative files of the cloned branch. */
  files: Map<string, string>;
}

/** Injected dependencies of {@link startSuggestion}. */
export interface StartSuggestionDeps {
  /** Registry used to find and create projects. */
  registry: ImportRegistry & {
    /** List all project records, most recently opened first. */
    list: () => Promise<ProjectRecord[]>;
  };
  /** Open the workspace of a project id. */
  getWorkspace: (id: string) => Promise<WorkspaceAdapter>;
  /** Fork a repository into the viewer's account. */
  forkRepo: (owner: string, repo: string) => Promise<ForkResult>;
  /** Merge the upstream default branch into a target branch. */
  syncFork: (owner: string, repo: string, branch: string) => Promise<void>;
  /** List branches whose name starts with a prefix. */
  listSuggestionBranches: (
    owner: string,
    repo: string,
    prefix: string,
  ) => Promise<SuggestionBranch[]>;
  /** Find the pull request whose head matches a ref. */
  findSuggestionPull: (
    owner: string,
    repo: string,
    head: string,
  ) => Promise<SuggestionPull | null>;
  /** Clone a repository, optionally at a branch, through the git relay. */
  clone: (owner: string, repo: string, ref?: string) => Promise<ClonedSuggestion>;
  /** Sleep for a number of milliseconds. */
  sleep: (ms: number) => Promise<void>;
  /** Current time, used for the suggestion branch timestamp. */
  now: () => Date;
}

/** Result of {@link startSuggestion}. */
export interface StartSuggestionResult {
  /** Id of the project to activate. */
  projectId: string;
  /** How the suggestion was resumed. */
  resumed: SuggestionResume;
}

/** Compare repository names the way GitHub does: case-insensitively. */
function sameRepo(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** Find an existing project for the same upstream repository. */
function findLocalProject(
  projects: ProjectRecord[],
  upstream: StartSuggestionUpstream,
): ProjectRecord | null {
  for (const project of projects) {
    const source = project.source;
    if (
      source.kind === 'github' &&
      sameRepo(source.upstream.owner, upstream.owner) &&
      sameRepo(source.upstream.repo, upstream.repo)
    ) {
      return project;
    }
  }

  return null;
}

/** Clone a target, retrying while a freshly created fork becomes ready. */
async function cloneTarget(
  deps: StartSuggestionDeps,
  target: SuggestionTarget,
  ref: string | undefined,
  retry: boolean,
): Promise<ClonedSuggestion> {
  const attempts = retry ? FORK_CLONE_ATTEMPTS : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return ref === undefined
        ? await deps.clone(target.owner, target.repo)
        : await deps.clone(target.owner, target.repo, ref);
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await deps.sleep(FORK_CLONE_RETRY_DELAY_MS);
      }
    }
  }

  throw lastError;
}

/** Resolve the upstream or the viewer's fork for the suggestion branch. */
async function resolveTarget(
  input: StartSuggestionInput,
  deps: StartSuggestionDeps,
): Promise<SuggestionTarget> {
  if (input.plan === 'branch') {
    return {
      owner: input.upstream.owner,
      repo: input.upstream.repo,
      defaultBranch: input.access.defaultBranch,
    };
  }

  const fork = await deps.forkRepo(input.upstream.owner, input.upstream.repo);
  return { owner: fork.owner, repo: fork.repo, defaultBranch: fork.defaultBranch };
}

/** Find a resumable suggestion branch and its pull request. */
async function findRemoteBranch(
  target: SuggestionTarget,
  login: string,
  deps: StartSuggestionDeps,
): Promise<{ branch: string; pull: SuggestionPull | null } | null> {
  const branches = await deps.listSuggestionBranches(
    target.owner,
    target.repo,
    suggestionPrefix(login),
  );
  const branch = latestBranch(
    branches.map((entry) => entry.name),
    login,
  );
  if (branch === null) return null;

  const pull = await deps.findSuggestionPull(
    target.owner,
    target.repo,
    `${target.owner}:${branch}`,
  );
  if (pull !== null && pull.state !== 'open') return null;
  return { branch, pull };
}

/** Sync the target default branch into the fork, ignoring every failure. */
async function syncBestEffort(
  target: SuggestionTarget,
  deps: StartSuggestionDeps,
): Promise<void> {
  try {
    await deps.syncFork(target.owner, target.repo, target.defaultBranch);
  } catch {
    // A failed sync only means the fresh branch may be slightly behind.
  }
}

/** Input of {@link importCloned}. */
interface ImportClonedInput {
  input: StartSuggestionInput;
  target: SuggestionTarget;
  branch: string;
  cloned: ClonedSuggestion;
  pushed: boolean;
  pullNumber: number | null;
}

/** Import a cloned suggestion branch into a new project. */
async function importCloned(
  args: ImportClonedInput,
  deps: StartSuggestionDeps,
): Promise<StartSuggestionResult> {
  const { input, target, branch, cloned } = args;
  const imported = await importIntoProject(
    {
      name: input.upstream.repo,
      files: cloned.files,
      upstream: {
        owner: input.upstream.owner,
        repo: input.upstream.repo,
        defaultBranch: target.defaultBranch,
      },
      target,
      branch,
      syncedSha: cloned.sha,
      private: input.access.private === true,
      pushed: args.pushed,
      pullNumber: args.pullNumber,
    },
    deps,
  );
  return { projectId: imported.projectId, resumed: args.pushed ? 'remote' : 'fresh' };
}

/**
 * Start or resume a suggestion for a repository.
 *
 * @param input - Upstream repository, viewer, edit plan and repository access.
 * @param deps - Injected GitHub, git, registry and workspace dependencies.
 * @returns The project id to activate and how it was resumed.
 */
export async function startSuggestion(
  input: StartSuggestionInput,
  deps: StartSuggestionDeps,
): Promise<StartSuggestionResult> {
  const local = findLocalProject(await deps.registry.list(), input.upstream);
  if (local) {
    return { projectId: local.id, resumed: 'local' };
  }

  const target = await resolveTarget(input, deps);
  const retry = input.plan === 'fork';
  const remote = await findRemoteBranch(target, input.session.login, deps);
  if (remote) {
    const cloned = await cloneTarget(deps, target, remote.branch, retry);
    return importCloned(
      {
        input,
        target,
        branch: remote.branch,
        cloned,
        pushed: true,
        pullNumber: remote.pull?.number ?? null,
      },
      deps,
    );
  }

  await syncBestEffort(target, deps);
  const cloned = await cloneTarget(deps, target, undefined, retry);
  const branch = suggestionBranch(input.session.login, deps.now());
  return importCloned(
    { input, target, branch, cloned, pushed: false, pullNumber: null },
    deps,
  );
}

export default startSuggestion;

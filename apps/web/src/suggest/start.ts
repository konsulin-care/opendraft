/**
 * Start or resume a draft: existing local project, the viewer's own remote
 * draft branch, then a fresh draft cloned into the project's persistent
 * repository.
 */

import type { ProjectRecord } from '@opendraft/workspace';
import type { BffSession, ForkResult, RepoPermissions } from '../github/bff-client';
import type { SuggestionBranch, SuggestionPull } from '../github/bff-suggest';
import {
  PLACEHOLDER,
  draftBranch,
  draftPrefix,
  findOwnDraft,
  suggestionPrefix,
} from './branches';
import { importIntoProject } from './import';
import type { ImportIntoProjectDeps, SuggestionRepoRef } from './import';

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

/** Injected dependencies of {@link startSuggestion}. */
export interface StartSuggestionDeps extends ImportIntoProjectDeps {
  /** Registry used to find and create projects. */
  registry: ImportIntoProjectDeps['registry'] & {
    /** List all project records, most recently opened first. */
    list: () => Promise<ProjectRecord[]>;
  };
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
  return {
    owner: fork.owner,
    repo: fork.repo,
    defaultBranch: fork.defaultBranch,
  };
}

/**
 * List the viewer's draft branches under both the new and legacy prefixes.
 *
 * @param target - Repository that owns the draft branch.
 * @param login - GitHub login of the viewer.
 * @param deps - Injected branch listing.
 * @returns Every candidate branch name, including other users' `od-*` refs.
 */
async function listOwnDraftBranches(
  target: SuggestionTarget,
  login: string,
  deps: StartSuggestionDeps,
): Promise<string[]> {
  const [current, legacy] = await Promise.all([
    deps.listSuggestionBranches(target.owner, target.repo, draftPrefix(login)),
    deps.listSuggestionBranches(
      target.owner,
      target.repo,
      suggestionPrefix(login),
    ),
  ]);
  return [...current, ...legacy].map((entry) => entry.name);
}

/** Find a resumable draft branch and its pull request. */
async function findRemoteBranch(
  target: SuggestionTarget,
  login: string,
  deps: StartSuggestionDeps,
): Promise<{ branch: string; pull: SuggestionPull | null } | null> {
  const branch = findOwnDraft(
    await listOwnDraftBranches(target, login, deps),
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

/**
 * Sync the target default branch into the fork, ignoring every failure.
 *
 * A `branch` plan targets the upstream itself, which has no fork to sync.
 */
async function syncBestEffort(
  target: SuggestionTarget,
  plan: SuggestionPlan,
  deps: StartSuggestionDeps,
): Promise<void> {
  if (plan === 'branch') return;

  try {
    await deps.syncFork(target.owner, target.repo, target.defaultBranch);
  } catch {
    // A failed sync only means the fresh branch may be slightly behind.
  }
}

/** Input of {@link importDraft}. */
interface ImportDraftInput {
  input: StartSuggestionInput;
  target: SuggestionTarget;
  branch: string;
  pushed: boolean;
  pullNumber: number | null;
}

/** Import a cloned or prepared draft branch into a new project. */
async function importDraft(
  args: ImportDraftInput,
  deps: StartSuggestionDeps,
): Promise<StartSuggestionResult> {
  const { input, target, branch } = args;
  const imported = await importIntoProject(
    {
      name: input.upstream.repo,
      upstream: {
        owner: input.upstream.owner,
        repo: input.upstream.repo,
        defaultBranch: target.defaultBranch,
      },
      target,
      branch,
      private: input.access.private === true,
      pushed: args.pushed,
      pullNumber: args.pullNumber,
      session: input.session,
    },
    deps,
  );
  return {
    projectId: imported.projectId,
    resumed: args.pushed ? 'remote' : 'fresh',
  };
}

/**
 * Start or resume a suggestion for a repository.
 *
 * An existing project for the same upstream wins. Otherwise the viewer's own
 * `od-<login>/` or legacy `opendraft/<login>/` branch is resumed on the target
 * repository. A fresh draft is cloned into the project's persistent repository
 * on the placeholder branch `od-<login>/untitled-draft`; fork targets are
 * synced best-effort before the draft is created.
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
  const remote = await findRemoteBranch(target, input.session.login, deps);
  if (remote) {
    return importDraft(
      {
        input,
        target,
        branch: remote.branch,
        pushed: true,
        pullNumber: remote.pull?.number ?? null,
      },
      deps,
    );
  }

  await syncBestEffort(target, input.plan, deps);
  return importDraft(
    {
      input,
      target,
      branch: draftBranch(input.session.login, PLACEHOLDER),
      pushed: false,
      pullNumber: null,
    },
    deps,
  );
}

export default startSuggestion;

/**
 * Submit a suggestion as a pull request on the upstream repository.
 *
 * A stored pull request is inspected first: when it was merged or closed the
 * submit stops without pushing. Otherwise the local edits are saved to the
 * suggestion branch and an open pull request is updated in place, while a
 * missing one is created. Every GitHub, git and registry dependency is
 * injected to keep the module unit-testable.
 */

import type { ProjectSourceGitHub } from '@opendraft/workspace';
import type { PullRequestInput, PullRequestResult } from '../github/bff-client';
import type { SuggestionPull } from '../github/bff-suggest';
import { saveToCopy } from './save';
import type { SaveDeps, SaveResult } from './save';

/** Input of {@link submitSuggestion}. */
export interface SubmitSuggestionInput {
  /** Pull request title. */
  title: string;
  /** Pull request body. */
  body: string;
}

/** Closed state of a suggestion's pull request. */
export type SubmitClosedState = 'merged' | 'closed';

/** Result of {@link submitSuggestion}. */
export type SubmitResult =
  | { kind: 'created' | 'updated'; number: number; url: string }
  | { kind: 'closed'; state: SubmitClosedState }
  | { kind: 'remote-moved' };

/** Injected dependencies of {@link submitSuggestion}. */
export interface SubmitDeps extends SaveDeps {
  /** Find the pull request whose head matches a suggestion branch. */
  findSuggestionPull: (
    owner: string,
    repo: string,
    head: string,
  ) => Promise<SuggestionPull | null>;
  /** Open a pull request between a head and a base branch. */
  createPullRequest: (
    owner: string,
    repo: string,
    input: PullRequestInput,
  ) => Promise<PullRequestResult>;
}

/**
 * Load the GitHub source of a suggestion project.
 *
 * @param projectId - Project id to load.
 * @param deps - Injected dependencies.
 * @returns The stored GitHub source.
 * @throws Error when the project is missing or is not backed by GitHub.
 */
async function loadSource(
  projectId: string,
  deps: SubmitDeps,
): Promise<ProjectSourceGitHub> {
  const project = await deps.registry.get(projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  if (project.source.kind !== 'github') {
    throw new Error(`Project is not a GitHub suggestion: ${projectId}`);
  }
  return project.source;
}

/**
 * Build the pull request head ref of a suggestion.
 *
 * Branches on a fork need the `owner:` prefix; branches on the upstream do not.
 *
 * @param source - Stored GitHub source of the suggestion.
 * @returns Head ref accepted by the pull request API.
 */
function headRef(source: ProjectSourceGitHub): string {
  const onUpstream =
    source.owner.toLowerCase() === source.upstream.owner.toLowerCase();
  return onUpstream ? source.branch : `${source.owner}:${source.branch}`;
}

/**
 * Store the created pull request number on the project source.
 *
 * The source is re-read after the save so the freshly stored branch state is
 * kept when the pull number is added.
 *
 * @param projectId - Project id to update.
 * @param number - Pull request number.
 * @param deps - Injected dependencies.
 */
async function storePullNumber(
  projectId: string,
  number: number,
  deps: SubmitDeps,
): Promise<void> {
  const source = await loadSource(projectId, deps);
  await deps.registry.setSource(projectId, { ...source, pullNumber: number });
}

/**
 * Submit the local edits of a suggestion as a pull request.
 *
 * A stored pull request is looked up first; a merged or closed pull stops the
 * submit with its state. The edits are then saved to the branch, which may
 * report a moved remote. An open pull request yields `updated`, otherwise a
 * pull request is created on the upstream and its number is stored.
 *
 * @param projectId - Project id of the suggestion.
 * @param input - Pull request title and body.
 * @param deps - Injected GitHub, git, registry and workspace dependencies.
 * @returns The created or updated pull request, a closed state, or a moved remote.
 */
export async function submitSuggestion(
  projectId: string,
  input: SubmitSuggestionInput,
  deps: SubmitDeps,
): Promise<SubmitResult> {
  const source = await loadSource(projectId, deps);
  const head = headRef(source);
  const { owner, repo, defaultBranch } = source.upstream;

  let open: SuggestionPull | null = null;
  if (source.pullNumber !== null) {
    const pull = await deps.findSuggestionPull(owner, repo, head);
    if (pull !== null && pull.state !== 'open') {
      return { kind: 'closed', state: pull.state };
    }
    open = pull;
  }

  const saved: SaveResult = await saveToCopy(projectId, {}, deps);
  if (saved.kind === 'remote-moved') return { kind: 'remote-moved' };
  if (open !== null) {
    return { kind: 'updated', number: open.number, url: open.url };
  }

  const created = await deps.createPullRequest(owner, repo, {
    title: input.title,
    head,
    base: defaultBranch,
    body: input.body,
  });
  await storePullNumber(projectId, created.number, deps);
  return { kind: 'created', number: created.number, url: created.url };
}

export default submitSuggestion;

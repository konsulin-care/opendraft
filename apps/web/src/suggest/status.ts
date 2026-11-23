/**
 * Report the remote state of a suggestion.
 *
 * The check answers whether a suggestion is still local, whether its branch
 * still exists, whether the remote branch moved since the last sync, and which
 * pull request state the viewer should see. Every GitHub dependency is
 * injected to keep the module unit-testable.
 */

import type { ProjectSourceGitHub } from '@opendraft/workspace';
import type { SuggestionBranch, SuggestionPull } from '../github/bff-suggest';

/** Remote state of a suggestion. */
export type SuggestionState =
  | 'local-only'
  | 'draft'
  | 'open'
  | 'revision-needed'
  | 'merged'
  | 'closed'
  | 'branch-deleted'
  | 'remote-moved';

/** Result of {@link checkSuggestion}. */
export interface SuggestionStatus {
  /** State the UI should present. */
  state: SuggestionState;
  /** Pull request number, when a pull request exists. */
  number?: number;
  /** Browser URL of the pull request, when one exists. */
  url?: string;
}

/** Injected dependencies of {@link checkSuggestion}. */
export interface CheckSuggestionDeps {
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

/**
 * Build the branch prefix that contains a suggestion branch.
 *
 * @param branch - Suggestion branch name.
 * @returns Everything up to and including the last slash.
 */
function branchPrefix(branch: string): string {
  const index = branch.lastIndexOf('/');
  return index === -1 ? branch : branch.slice(0, index + 1);
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
 * Resolve the suggestion state of a pull request.
 *
 * An open pull request whose latest review requests changes is
 * `revision-needed`; every other request maps to its own state.
 *
 * @param pull - Matching pull request.
 * @returns Suggestion state derived from the pull request.
 */
function pullState(
  pull: SuggestionPull,
): 'open' | 'revision-needed' | 'merged' | 'closed' {
  if (pull.state === 'open' && pull.reviewState === 'changes_requested') {
    return 'revision-needed';
  }
  return pull.state;
}

/**
 * Build a status that carries the pull request identity.
 *
 * @param state - Pull request state.
 * @param pull - Matching pull request.
 * @returns Status with number and url.
 */
function withPull(
  state: 'open' | 'revision-needed' | 'merged' | 'closed',
  pull: SuggestionPull,
): SuggestionStatus {
  return { state, number: pull.number, url: pull.url };
}

/**
 * Check the remote state of a suggestion.
 *
 * An unpushed suggestion is `local-only` without any remote call. A pushed
 * branch that no longer exists is `branch-deleted`; a branch head that differs
 * from the synced commit is `remote-moved`. Otherwise the latest pull request
 * decides between `open`, `revision-needed`, `merged`, `closed`, and `draft`
 * when none exists.
 *
 * @param source - Stored GitHub source of the suggestion.
 * @param deps - Injected branch listing and pull request lookup.
 * @returns The suggestion state and, when present, the pull request identity.
 */
export async function checkSuggestion(
  source: ProjectSourceGitHub,
  deps: CheckSuggestionDeps,
): Promise<SuggestionStatus> {
  if (!source.pushed) {
    return { state: 'local-only' };
  }

  const branches = await deps.listSuggestionBranches(
    source.owner,
    source.repo,
    branchPrefix(source.branch),
  );
  const branch = branches.find((entry) => entry.name === source.branch);
  if (!branch) {
    return { state: 'branch-deleted' };
  }
  if (branch.sha !== source.syncedSha) {
    return { state: 'remote-moved' };
  }

  const { owner, repo } = source.upstream;
  const pull = await deps.findSuggestionPull(owner, repo, headRef(source));
  if (pull === null) {
    return { state: 'draft' };
  }

  return withPull(pullState(pull), pull);
}

export default checkSuggestion;

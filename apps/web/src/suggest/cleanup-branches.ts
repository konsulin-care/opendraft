/**
 * Sweep stale suggestion branches from the push-target repository.
 *
 * A branch is removed only when GitHub proves it is no longer needed: its
 * latest pull request is closed, or merged into a branch head that the pull
 * request actually reviewed. The current draft branch, branches with an open
 * pull request and branches without any pull request are always kept.
 */

import type { SuggestionBranch, SuggestionPull } from '../github/bff-suggest';
import { draftPrefix, suggestionPrefix } from './branches';

/** Maximum number of branches one sweep inspects. */
const MAX_CANDIDATES = 20;

/** Repository and current branch a sweep runs against. */
export interface SweepSource {
  /** Repository owner login. */
  owner: string;
  /** Repository name. */
  repo: string;
  /** Currently tracked branch that must never be deleted. */
  branch: string;
}

/** Injected dependencies of {@link sweepBranches}. */
export interface SweepDeps {
  /** List branches whose name starts with a prefix. */
  listSuggestionBranches: (
    owner: string,
    repo: string,
    prefix: string,
  ) => Promise<SuggestionBranch[]>;
  /** Find the latest pull request whose head matches a ref. */
  findSuggestionPull: (
    owner: string,
    repo: string,
    head: string,
  ) => Promise<SuggestionPull | null>;
  /** Delete a remote branch. */
  deleteBranch: (owner: string, repo: string, branch: string) => Promise<void>;
}

/** Branches a sweep deleted and branches it deliberately kept. */
export interface SweepResult {
  /** Deleted branch names. */
  deleted: string[];
  /** Branch names that were kept. */
  skipped: string[];
}

/**
 * Decide whether a branch can be deleted from its latest pull request.
 *
 * A closed pull request frees its branch. A merged pull request frees the
 * branch only when the branch still points at the reviewed head commit, so
 * commits pushed after the merge are never discarded.
 *
 * @param branch - Candidate branch with its current head SHA.
 * @param pull - Latest pull request of the branch, or null when none exists.
 * @returns True when the branch is safe to delete.
 */
function isDeletable(
  branch: SuggestionBranch,
  pull: SuggestionPull | null,
): boolean {
  if (pull === null || pull.state === 'open') {
    return false;
  }

  if (pull.state === 'closed') {
    return true;
  }

  return pull.headSha !== undefined && pull.headSha === branch.sha;
}

/**
 * Collect the viewer's branches under both supported prefixes.
 *
 * The new `od-<login>/` prefix is listed before the legacy
 * `opendraft/<login>/` prefix, duplicates are dropped and the total number of
 * candidates is capped.
 *
 * @param source - Repository to inspect.
 * @param login - GitHub login of the viewer.
 * @param deps - Injected branch listing dependency.
 * @returns Candidate branches in listing order.
 */
async function collectCandidates(
  source: SweepSource,
  login: string,
  deps: SweepDeps,
): Promise<SuggestionBranch[]> {
  const prefixes = [draftPrefix(login), suggestionPrefix(login)];
  const candidates: SuggestionBranch[] = [];
  const seen = new Set<string>();

  for (const prefix of prefixes) {
    const branches = await deps.listSuggestionBranches(
      source.owner,
      source.repo,
      prefix,
    );

    for (const branch of branches) {
      if (
        !branch.name.startsWith(prefix) ||
        branch.name.length === prefix.length ||
        seen.has(branch.name)
      ) {
        continue;
      }

      seen.add(branch.name);
      candidates.push(branch);
      if (candidates.length >= MAX_CANDIDATES) {
        return candidates;
      }
    }
  }

  return candidates;
}

/**
 * Delete stale branches of the signed-in viewer.
 *
 * Every candidate is looked up through its latest pull request on the
 * repository. Closed pull requests free their branch; merged pull requests
 * free it only when the branch head still equals the reviewed head SHA. The
 * current branch and every branch with an open or missing pull request are
 * kept.
 *
 * @param source - Repository and current branch to protect.
 * @param login - GitHub login whose branch prefixes are swept.
 * @param deps - Injected branch listing, pull request and delete operations.
 * @returns The deleted and kept branch names.
 */
export async function sweepBranches(
  source: SweepSource,
  login: string,
  deps: SweepDeps,
): Promise<SweepResult> {
  const result: SweepResult = { deleted: [], skipped: [] };
  const candidates = await collectCandidates(source, login, deps);

  for (const branch of candidates) {
    if (branch.name === source.branch) {
      result.skipped.push(branch.name);
      continue;
    }

    const pull = await deps.findSuggestionPull(
      source.owner,
      source.repo,
      `${source.owner}:${branch.name}`,
    );

    if (!isDeletable(branch, pull)) {
      result.skipped.push(branch.name);
      continue;
    }

    await deps.deleteBranch(source.owner, source.repo, branch.name);
    result.deleted.push(branch.name);
  }

  return result;
}

export default sweepBranches;

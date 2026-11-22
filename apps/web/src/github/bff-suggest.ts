/**
 * Client helpers for the suggestion flow: branch listing, pull request lookup
 * and best-effort upstream sync. Every GitHub interaction goes through the BFF
 * and the fetch implementation is injectable for tests.
 */

import { get, post, readJson, toBffError } from './bff-http';

const REPOS_PATH = '/@api/repos';

/** One suggestion branch returned by {@link listSuggestionBranches}. */
export interface SuggestionBranch {
  /** Branch name, e.g. `opendraft/ada/20260101-120000`. */
  name: string;
  /** Commit SHA the branch head points at. */
  sha: string;
}

/** State of a pull request as reported by the BFF. */
export type SuggestionPullState = 'open' | 'closed' | 'merged';

/** A pull request matching a suggestion branch. */
export interface SuggestionPull {
  /** Pull request number within the repository. */
  number: number;
  /** Browser URL of the pull request. */
  url: string;
  /** Current pull request state. */
  state: SuggestionPullState;
}

/**
 * Build the BFF path of a repository resource.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @returns Encoded repository path prefix.
 */
function repoPath(owner: string, repo: string): string {
  return `${REPOS_PATH}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

/**
 * List the suggestion branches of a repository under a prefix.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param prefix - Branch prefix, e.g. `opendraft/ada/`.
 * @param fetchFn - Fetch implementation; injectable for tests.
 * @returns Matching branch names with their head SHA.
 */
export async function listSuggestionBranches(
  owner: string,
  repo: string,
  prefix: string,
  fetchFn: typeof fetch = fetch,
): Promise<SuggestionBranch[]> {
  const path = `${repoPath(owner, repo)}/branches?prefix=${encodeURIComponent(prefix)}`;
  const response = await get(path, fetchFn);
  return (await readJson<SuggestionBranch[]>(response)) ?? [];
}

/**
 * Find the pull request whose head matches a suggestion branch.
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param head - Head ref, optionally `owner:branch`.
 * @param fetchFn - Fetch implementation; injectable for tests.
 * @returns The matching pull request, or null when the BFF answers 404.
 */
export async function findSuggestionPull(
  owner: string,
  repo: string,
  head: string,
  fetchFn: typeof fetch = fetch,
): Promise<SuggestionPull | null> {
  const path = `${repoPath(owner, repo)}/pulls?head=${encodeURIComponent(head)}`;
  const response = await fetchFn(path, { credentials: 'same-origin' });
  if (response.status === 404) return null;
  if (!response.ok) throw await toBffError(response);
  return (await readJson<SuggestionPull>(response)) ?? null;
}

/**
 * Merge the upstream default branch into a fork branch.
 * @param owner - Fork owner login.
 * @param repo - Fork repository name.
 * @param branch - Branch to update.
 * @param fetchFn - Fetch implementation; injectable for tests.
 * @throws {@link BffError} with code `conflict` when GitHub reports a conflict.
 */
export async function syncFork(
  owner: string,
  repo: string,
  branch: string,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  const path = `${repoPath(owner, repo)}/merge-upstream`;
  await post(path, { branch }, fetchFn);
}

/**
 * Client for the OpenDraft Go BFF (`/@api/*`).
 *
 * Every call is same-origin: the browser sends the sealed session cookie and
 * never sees a GitHub token. Non-2xx answers map to {@link BffError} carrying
 * the stable error code from the JSON body.
 */

import { BffError, get, post, readJson, toBffError } from './bff-http';

export { BffError };

/** Public session identity returned by `GET /@api/auth/session`. */
export interface BffSession {
  /** GitHub login of the signed-in user. */
  login: string;
  /** Numeric GitHub user id. */
  id: number;
  /** Display name, or null when the account has none. */
  name: string | null;
  /** Absolute session expiry as an RFC 3339 timestamp. */
  expiresAt: string;
}

/** Session availability returned by {@link getSessionState}. */
export interface SessionState {
  session: BffSession | null;
  loginEnabled: boolean;
}

/** Repository permissions and installation state. */
export interface RepoPermissions {
  /** Whether the signed-in user may push to the repository. */
  push: boolean;
  /** Whether the GitHub App is installed on the repository. */
  installed: boolean;
  /** Default branch name of the repository. */
  defaultBranch: string;
  /** Whether the repository is private; absent on older BFF answers. */
  private?: boolean;
  /** Whether the repository policy allows forking; absent on older answers. */
  allowForking?: boolean;
  /** Whether the app is installed for all viewer repositories; optional. */
  viewerInstalledAll?: boolean;
}

/** Input of {@link createPullRequest}. */
export interface PullRequestInput {
  /** Pull request title. */
  title: string;
  /** Head branch, optionally `owner:branch`. */
  head: string;
  /** Base branch. */
  base: string;
  /** Pull request body. */
  body: string;
}

/** Result of {@link createPullRequest}. */
export interface PullRequestResult {
  number: number;
  url: string;
}

/** Result of {@link forkRepo}. */
export interface ForkResult {
  owner: string;
  repo: string;
  defaultBranch: string;
}

/** An account the viewer can publish a repository to. */
export interface Owner {
  /** GitHub login of the account. */
  login: string;
  /** Account type: `User` or `Organization`. */
  type: string;
  /** Avatar image URL of the account. */
  avatarUrl: string;
  /** Whether the app installation covers all repositories. */
  allRepos: boolean;
}

/** Input of {@link createRepo}. */
export interface CreateRepoInput {
  owner: string;
  name: string;
  visibility: string;
  description?: string;
}

/** Result of {@link createRepo}. */
export interface CreateRepoResult {
  owner: string;
  name: string;
  htmlUrl: string;
  defaultBranch: string;
}

const AUTH_PREFIX = '/@api/auth';
const REPOS_PATH = '/@api/repos';
const OWNERS_PATH = '/@api/owners';

/**
 * Fetch the current session and whether login is enabled.
 *
 * @param fetchFn - Fetch implementation; injectable for tests.
 * @returns The session state; a 401 or `loginEnabled: false` means no session.
 */
export async function getSessionState(fetchFn: typeof fetch = fetch): Promise<SessionState> {
  const response = await fetchFn(`${AUTH_PREFIX}/session`, { credentials: 'same-origin' });
  if (response.status === 401) return { session: null, loginEnabled: true };
  if (!response.ok) throw await toBffError(response);
  const body = (await response.json()) as BffSession | { loginEnabled?: boolean };
  if (typeof body === 'object' && body !== null && 'loginEnabled' in body && body.loginEnabled === false) {
    return { session: null, loginEnabled: false };
  }
  return { session: body as BffSession, loginEnabled: true };
}

/**
 * Fetch the current session.
 *
 * @param fetchFn - Fetch implementation; injectable for tests.
 * @returns The session identity, or null when unauthenticated (401).
 */
export async function getSession(fetchFn: typeof fetch = fetch): Promise<BffSession | null> {
  return (await getSessionState(fetchFn)).session;
}

/**
 * Clear the BFF session cookie and revoke the upstream token when possible.
 * @param fetchFn - Fetch implementation; injectable for tests.
 */
export async function logout(fetchFn: typeof fetch = fetch): Promise<void> {
  await post(`${AUTH_PREFIX}/logout`, undefined, fetchFn);
}

/**
 * Read permissions and installation state for a repository.
 *
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param fetchFn - Fetch implementation; injectable for tests.
 * @returns Push permission, installation flag and default branch.
 */
export async function getRepoPermissions(
  owner: string,
  repo: string,
  fetchFn: typeof fetch = fetch,
): Promise<RepoPermissions> {
  const path = `${REPOS_PATH}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/permissions`;
  const response = await get(path, fetchFn);
  return (await response.json()) as RepoPermissions;
}

/**
 * Open a pull request on a repository.
 *
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param input - Title, head, base and body of the pull request.
 * @param fetchFn - Fetch implementation; injectable for tests.
 * @returns Pull request number and HTML URL.
 */
export async function createPullRequest(
  owner: string,
  repo: string,
  input: PullRequestInput,
  fetchFn: typeof fetch = fetch,
): Promise<PullRequestResult> {
  const path = `${REPOS_PATH}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls`;
  const response = await post(path, input, fetchFn);
  const result = await readJson<PullRequestResult>(response);
  if (!result) throw new BffError('empty_response', response.status);
  return result;
}

/**
 * Fork a repository into the signed-in user's account.
 *
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param fetchFn - Fetch implementation; injectable for tests.
 * @returns Owner, name and default branch of the fork.
 */
export async function forkRepo(
  owner: string,
  repo: string,
  fetchFn: typeof fetch = fetch,
): Promise<ForkResult> {
  const path = `${REPOS_PATH}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/forks`;
  const response = await post(path, undefined, fetchFn);
  const result = await readJson<ForkResult>(response);
  if (!result) throw new BffError('empty_response', response.status);
  return result;
}

/**
 * List the accounts the viewer can create repositories under.
 *
 * @param fetchFn - Fetch implementation; injectable for tests.
 * @returns Owners from the GitHub App installations visible to the viewer.
 */
export async function listOwners(fetchFn: typeof fetch = fetch): Promise<Owner[]> {
  const response = await get(OWNERS_PATH, fetchFn);
  return (await response.json()) as Owner[];
}

/**
 * Create a repository for the signed-in user or an organization.
 *
 * @param input - Owner, name, visibility and optional description.
 * @param fetchFn - Fetch implementation; injectable for tests.
 * @returns Owner, name, HTML URL and default branch of the created repository.
 */
export async function createRepo(
  input: CreateRepoInput,
  fetchFn: typeof fetch = fetch,
): Promise<CreateRepoResult> {
  const response = await post(REPOS_PATH, input, fetchFn);
  const result = await readJson<CreateRepoResult>(response);
  if (!result) throw new BffError('empty_response', response.status);
  return result;
}

/**
 * Build the sign-in URL that returns to a same-origin path afterwards.
 *
 * @param returnTo - Relative path to reopen after sign-in.
 * @returns The login URL with an encoded `return_to` query parameter.
 */
export function loginUrl(returnTo: string): string {
  return `${AUTH_PREFIX}/login?return_to=${encodeURIComponent(returnTo)}`;
}

/**
 * Build the GitHub App installation URL that returns to a same-origin path.
 *
 * @param returnTo - Relative path to reopen after installation.
 * @returns The install URL with an encoded `return_to` query parameter.
 */
export function installUrl(returnTo: string): string {
  return `${AUTH_PREFIX}/install?return_to=${encodeURIComponent(returnTo)}`;
}

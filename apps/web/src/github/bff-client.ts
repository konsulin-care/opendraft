/**
 * Client for the OpenDraft Go BFF (`/@api/*`).
 *
 * Every call is same-origin: the browser sends the sealed session cookie and
 * never sees a GitHub token. Non-2xx answers map to {@link BffError} carrying
 * the stable error code from the JSON body.
 */

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

/** Error raised for any non-2xx BFF answer. */
export class BffError extends Error {
  /** Stable error code from the JSON body, e.g. `unauthenticated`. */
  readonly code: string;

  /** HTTP status of the failed response. */
  readonly status: number;

  /**
   * @param code - Stable error code, or `http_<status>` when absent.
   * @param status - HTTP status of the failed response.
   */
  constructor(code: string, status: number) {
    super(code);
    this.name = 'BffError';
    this.code = code;
    this.status = status;
  }
}

/** Repository permissions and installation state. */
export interface RepoPermissions {
  /** Whether the signed-in user may push to the repository. */
  push: boolean;
  /** Whether the GitHub App is installed on the repository. */
  installed: boolean;
  /** Default branch name of the repository. */
  defaultBranch: string;
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
  /** Pull request number. */
  number: number;
  /** HTML URL of the pull request. */
  url: string;
}

/** Result of {@link forkRepo}. */
export interface ForkResult {
  /** Owner login of the fork. */
  owner: string;
  /** Repository name of the fork. */
  repo: string;
  /** Default branch of the fork. */
  defaultBranch: string;
}

/** Input of {@link createRepo}. */
export interface CreateRepoInput {
  /** Owner login that receives the repository. */
  owner: string;
  /** Repository name. */
  name: string;
  /** Visibility accepted by the BFF, `public` or `private`. */
  visibility: string;
  /** Optional repository description. */
  description?: string;
}

/** Result of {@link createRepo}. */
export interface CreateRepoResult {
  /** Owner login of the created repository. */
  owner: string;
  /** Repository name. */
  name: string;
  /** HTML URL of the created repository. */
  htmlUrl: string;
  /** Default branch of the created repository. */
  defaultBranch: string;
}

const AUTH_PREFIX = '/@api/auth';
const REPOS_PATH = '/@api/repos';

/**
 * Read the stable error code from a failed response.
 *
 * @param response - Failed fetch response.
 * @returns The server error code, or `http_<status>` when the body is missing
 *          or malformed.
 */
async function readErrorCode(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null && 'error' in body) {
      const code = (body as { error?: unknown }).error;
      if (typeof code === 'string') return code;
    }
  } catch {
    // Fall through to the status-derived code.
  }
  return `http_${response.status}`;
}

/**
 * Build the {@link BffError} for a failed response without relaying its body.
 *
 * @param response - Failed fetch response.
 * @returns The matching BFF error.
 */
async function toBffError(response: Response): Promise<BffError> {
  return new BffError(await readErrorCode(response), response.status);
}

/**
 * Issue a same-origin GET request.
 *
 * @param path - BFF-relative path.
 * @param fetchFn - Fetch implementation; injectable for tests.
 * @returns The successful response.
 */
async function get(path: string, fetchFn: typeof fetch): Promise<Response> {
  const response = await fetchFn(path, { credentials: 'same-origin' });
  if (!response.ok) throw await toBffError(response);
  return response;
}

/**
 * Issue a same-origin JSON POST request.
 *
 * @param path - BFF-relative path.
 * @param body - JSON body, or undefined for a bodyless POST.
 * @param fetchFn - Fetch implementation; injectable for tests.
 * @returns The successful response.
 */
async function post(path: string, body: unknown, fetchFn: typeof fetch): Promise<Response> {
  const response = await fetchFn(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw await toBffError(response);
  return response;
}

/**
 * Read the optional JSON body of a successful response.
 *
 * @param response - Successful fetch response.
 * @returns The parsed body, or undefined for an empty/204 answer.
 */
async function readJson<T>(response: Response): Promise<T | undefined> {
  if (response.status === 204) return undefined;
  return (await response.json()) as T;
}

/**
 * Fetch the current session.
 *
 * @param fetchFn - Fetch implementation; injectable for tests.
 * @returns The session identity, or null when unauthenticated (401).
 */
export async function getSession(fetchFn: typeof fetch = fetch): Promise<BffSession | null> {
  const response = await fetchFn(`${AUTH_PREFIX}/session`, { credentials: 'same-origin' });
  if (response.status === 401) return null;
  if (!response.ok) throw await toBffError(response);
  return (await response.json()) as BffSession;
}

/**
 * Clear the BFF session cookie and revoke the upstream token when possible.
 *
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

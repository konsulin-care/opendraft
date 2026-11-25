/**
 * Anonymous GitHub reader.
 *
 * Public repositories are read entirely in the browser against api.github.com
 * and raw.githubusercontent.com. Both send permissive CORS headers and no
 * token is ever involved.
 */

const GITHUB_API = 'https://api.github.com';
const GITHUB_RAW = 'https://raw.githubusercontent.com';
const API_ACCEPT = 'application/vnd.github+json';
const MAX_FILE_SIZE = 1_000_000;

/** Raised when GitHub answers 404 for a repository, ref, tree or blob. */
export class NotFoundError extends Error {
  /**
   * @param message - Human readable description of the missing resource.
   */
  constructor(message = 'not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

/** Raised when the GitHub anonymous rate limit is exhausted (403/429). */
export class RateLimitedError extends Error {
  /**
   * @param message - Human readable description of the rate limit failure.
   */
  constructor(message = 'rate limited') {
    super(message);
    this.name = 'RateLimitedError';
  }
}

/** A resolved commit: its SHA plus the SHA of its root tree. */
export interface ResolvedCommit {
  /** Commit SHA. */
  sha: string;
  /** Root tree SHA of the commit. */
  treeSha: string;
}

/** One entry of a git tree as returned by the GitHub trees API. */
export interface TreeEntry {
  /** Git object type, e.g. `blob` or `tree`. */
  type: string;
  /** Repository-relative path. */
  path: string;
  /** Blob size in bytes; 0 for trees. */
  size: number;
}

/** A public repository snapshot pinned to one commit. */
export interface PublicSnapshot {
  /** Commit SHA the snapshot was taken at. */
  sha: string;
  /** File contents keyed by repository-relative path. */
  files: Map<string, string>;
}

/**
 * Throw the matching typed error for a failed GitHub response.
 *
 * @param response - Response returned by fetch.
 * @returns Nothing; throws when the response is not successful.
 */
function assertOk(response: Response): void {
  if (response.status === 404) throw new NotFoundError();
  const rateLimitRemaining = response.headers.get('x-ratelimit-remaining');
  if ((response.status === 403 || response.status === 429) && rateLimitRemaining === '0') {
    throw new RateLimitedError();
  }
  if (!response.ok) {
    throw new Error(`GitHub request failed with status ${response.status}`);
  }
}

/**
 * Build an API URL below `https://api.github.com/repos/{owner}/{repo}`.
 *
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param suffix - Path appended after the repository segments.
 * @returns The absolute API URL.
 */
function repoApiUrl(owner: string, repo: string, suffix: string): string {
  return `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}${suffix}`;
}

/**
 * Resolve a ref (branch, tag or SHA) to a commit and its root tree.
 *
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param ref - Ref to resolve; defaults to `HEAD`.
 * @param fetchFn - Fetch implementation; injectable for tests.
 * @returns The commit SHA and its root tree SHA.
 */
export async function resolveCommit(
  owner: string,
  repo: string,
  ref = 'HEAD',
  fetchFn: typeof fetch = fetch,
): Promise<ResolvedCommit> {
  const url = repoApiUrl(owner, repo, `/commits/${encodeURIComponent(ref)}`);
  const response = await fetchFn(url, { headers: { Accept: API_ACCEPT } });
  assertOk(response);
  const body = (await response.json()) as {
    sha: string;
    commit: { tree: { sha: string } };
  };
  return { sha: body.sha, treeSha: body.commit.tree.sha };
}

/**
 * List the entries of a git tree recursively.
 *
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param treeSha - SHA of the tree to list.
 * @param fetchFn - Fetch implementation; injectable for tests.
 * @returns All tree entries, including nested ones.
 */
export async function listTree(
  owner: string,
  repo: string,
  treeSha: string,
  fetchFn: typeof fetch = fetch,
): Promise<TreeEntry[]> {
  const url = repoApiUrl(owner, repo, `/git/trees/${encodeURIComponent(treeSha)}?recursive=1`);
  const response = await fetchFn(url, { headers: { Accept: API_ACCEPT } });
  assertOk(response);
  const body = (await response.json()) as { tree: TreeEntry[] };
  return body.tree;
}

/**
 * Check whether a path is part of the snapshot whitelist.
 *
 * @param path - Repository-relative path.
 * @returns True for `opendraft.yml` and everything below `manuscripts/`.
 */
function isSnapshotPath(path: string): boolean {
  return path === 'opendraft.yml' || path.startsWith('manuscripts/');
}

/**
 * Build the raw download URL for one blob, pinned to a commit SHA.
 *
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param sha - Commit SHA.
 * @param path - Repository-relative blob path.
 * @returns The absolute raw.githubusercontent.com URL.
 */
function rawUrl(owner: string, repo: string, sha: string, path: string): string {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `${GITHUB_RAW}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${sha}/${encodedPath}`;
}

/** Optional controls for {@link loadPublicSnapshot}. */
export interface LoadPublicSnapshotOptions {
  /** Pre-resolved commit; when given the commit lookup is skipped. */
  commit?: ResolvedCommit;
  /** Maximum number of concurrent blob downloads; defaults to 6. */
  concurrency?: number;
}

/** Default number of concurrent blob downloads. */
const DEFAULT_CONCURRENCY = 6;

/**
 * Load the reader-visible files of a public repository at one commit.
 *
 * Only `opendraft.yml` and `manuscripts/**` blobs up to 1 MB are downloaded.
 * The ref is resolved to a SHA first so every blob pins to the same commit.
 * Eligible blobs are downloaded through a bounded worker pool; the first error
 * rejects the whole call. Files are returned in tree order.
 *
 * @param owner - Repository owner login.
 * @param repo - Repository name.
 * @param ref - Ref to load; defaults to `HEAD`.
 * @param fetchFn - Fetch implementation; injectable for tests.
 * @param options - Optional resolved commit and concurrency cap.
 * @returns The commit SHA and the downloaded files keyed by path.
 */
// eslint-disable-next-line max-params -- public API keeps ref/fetchFn positional for compatibility
export async function loadPublicSnapshot(
  owner: string,
  repo: string,
  ref = 'HEAD',
  fetchFn: typeof fetch = fetch,
  options: LoadPublicSnapshotOptions = {},
): Promise<PublicSnapshot> {
  const commit = options.commit ?? (await resolveCommit(owner, repo, ref, fetchFn));
  const entries = await listTree(owner, repo, commit.treeSha, fetchFn);

  const eligible = entries.filter(
    (entry) =>
      entry.type === 'blob' && entry.size <= MAX_FILE_SIZE && isSnapshotPath(entry.path),
  );
  const concurrency = Math.max(1, Math.floor(options.concurrency ?? DEFAULT_CONCURRENCY));
  const contents: string[] = new Array(eligible.length);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < eligible.length) {
      const index = cursor++;
      const entry = eligible[index];
      const response = await fetchFn(rawUrl(owner, repo, commit.sha, entry.path));
      assertOk(response);
      contents[index] = await response.text();
    }
  };

  const workers = Math.min(concurrency, eligible.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));

  const files = new Map<string, string>();
  eligible.forEach((entry, index) => files.set(entry.path, contents[index]));

  return { sha: commit.sha, files };
}

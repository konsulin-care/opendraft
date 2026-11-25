import { describe, expect, it, vi } from 'vitest';
import {
  listTree,
  loadPublicSnapshot,
  NotFoundError,
  RateLimitedError,
  resolveCommit,
  type TreeEntry,
} from './github-public';

const OWNER = 'konsulin-care';
const REPO = 'citizen-science';
const SHA = 'abc123';
const TREE_SHA = 'tree456';

const COMMIT = { sha: SHA, commit: { tree: { sha: TREE_SHA } } };

const TREE: { tree: TreeEntry[] } = {
  tree: [
    { type: 'blob', path: 'opendraft.yml', size: 12 },
    { type: 'blob', path: 'manuscripts/chapter one.qmd', size: 20 },
    { type: 'tree', path: 'manuscripts/sub', size: 0 },
    { type: 'blob', path: 'manuscripts/sub/notes.md', size: 5 },
    { type: 'blob', path: 'manuscripts/huge.qmd', size: 1_000_001 },
    { type: 'blob', path: 'README.md', size: 8 },
  ],
};

/**
 * Build a minimal fetch Response double.
 *
 * @param body - JSON body returned by `json()`.
 * @param status - HTTP status.
 * @param headers - Optional response headers.
 * @returns The response double.
 */
function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
  } as unknown as Response;
}

/**
 * Build a minimal text fetch Response double.
 *
 * @param text - Body returned by `text()`.
 * @param status - HTTP status.
 * @returns The response double.
 */
function textResponse(text: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => text,
  } as unknown as Response;
}

/** One blob request held open until the test resolves it. */
interface PendingBlob {
  url: string;
  resolve: (response: Response) => void;
}

/** Fetch double that lets the test resolve blob requests manually. */
interface ManualBlobFetch {
  fetchFn: ReturnType<typeof vi.fn>;
  pending: PendingBlob[];
  maxInFlight: () => number;
}

/**
 * Build a fetch double that holds blob requests open until resolved manually.
 *
 * @param entries - Tree entries returned by the trees API.
 * @returns The fetch double plus its pending queue and in-flight tracker.
 */
function createManualBlobFetch(entries: TreeEntry[]): ManualBlobFetch {
  const pending: PendingBlob[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const fetchFn = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/git/trees/')) return Promise.resolve(jsonResponse({ tree: entries }));
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    return new Promise<Response>((resolve) => {
      pending.push({
        url,
        resolve: (response) => {
          inFlight -= 1;
          resolve(response);
        },
      });
    });
  });
  return { fetchFn, pending, maxInFlight: () => maxInFlight };
}

/**
 * Resolve pending blob requests until the snapshot promise settles.
 *
 * @param pending - Queue of blob requests awaiting resolution.
 * @param promise - Snapshot promise that settles once all work is done.
 * @returns A promise resolved after the snapshot promise settles.
 */
async function drainUntilSettled(pending: PendingBlob[], promise: Promise<unknown>): Promise<void> {
  let settled = false;
  promise.finally(() => {
    settled = true;
  });
  while (!settled) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    const next = pending.shift();
    if (next) next.resolve(textResponse(`body:${next.url}`));
  }
}

/**
 * Build a fetch double that answers tree and eligible blob requests.
 *
 * @returns A fetch double serving the shared fixture tree and blobs.
 */
function snapshotFetch(): ReturnType<typeof vi.fn> {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/git/trees/')) return jsonResponse(TREE);
    if (url.endsWith('/opendraft.yml')) return textResponse('schema: 1\n');
    if (url.endsWith('/manuscripts/chapter%20one.qmd')) return textResponse('# Chapter\n');
    if (url.endsWith('/manuscripts/sub/notes.md')) return textResponse('notes\n');
    throw new Error(`unexpected URL ${url}`);
  });
}

describe('resolveCommit', () => {
  it('calls the GitHub commits API with the ref and JSON accept header', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(COMMIT));

    await expect(
      resolveCommit(OWNER, REPO, 'feature/x', fetchFn as unknown as typeof fetch),
    ).resolves.toEqual({ sha: SHA, treeSha: TREE_SHA });

    expect(fetchFn).toHaveBeenCalledWith(
      `https://api.github.com/repos/${OWNER}/${REPO}/commits/feature%2Fx`,
      { headers: { Accept: 'application/vnd.github+json' } },
    );
  });

  it('defaults the ref to HEAD', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(COMMIT));

    await resolveCommit(OWNER, REPO, undefined, fetchFn as unknown as typeof fetch);

    expect(fetchFn).toHaveBeenCalledWith(
      `https://api.github.com/repos/${OWNER}/${REPO}/commits/HEAD`,
      { headers: { Accept: 'application/vnd.github+json' } },
    );
  });
});

describe('listTree', () => {
  it('requests the tree recursively and returns its entries', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(TREE));

    const entries = await listTree(
      OWNER,
      REPO,
      TREE_SHA,
      fetchFn as unknown as typeof fetch,
    );

    expect(entries).toEqual(TREE.tree);
    expect(fetchFn).toHaveBeenCalledWith(
      `https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${TREE_SHA}?recursive=1`,
      { headers: { Accept: 'application/vnd.github+json' } },
    );
  });
});

describe('loadPublicSnapshot', () => {
  it('pins raw downloads to the resolved SHA and fetches only snapshot files', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/commits/')) return jsonResponse(COMMIT);
      if (url.includes('/git/trees/')) return jsonResponse(TREE);
      if (url.endsWith('/opendraft.yml')) return textResponse('schema: 1\n');
      if (url.endsWith('/manuscripts/chapter%20one.qmd')) return textResponse('# Chapter\n');
      if (url.endsWith('/manuscripts/sub/notes.md')) return textResponse('notes\n');
      throw new Error(`unexpected URL ${url}`);
    });

    const snapshot = await loadPublicSnapshot(
      OWNER,
      REPO,
      'main',
      fetchFn as unknown as typeof fetch,
    );

    expect(snapshot.sha).toBe(SHA);
    expect([...snapshot.files.entries()]).toEqual([
      ['opendraft.yml', 'schema: 1\n'],
      ['manuscripts/chapter one.qmd', '# Chapter\n'],
      ['manuscripts/sub/notes.md', 'notes\n'],
    ]);

    const rawCalls = fetchFn.mock.calls
      .map(([input]) => String(input))
      .filter((url) => url.startsWith('https://raw.githubusercontent.com/'));

    expect(rawCalls).toEqual([
      `https://raw.githubusercontent.com/${OWNER}/${REPO}/${SHA}/opendraft.yml`,
      `https://raw.githubusercontent.com/${OWNER}/${REPO}/${SHA}/manuscripts/chapter%20one.qmd`,
      `https://raw.githubusercontent.com/${OWNER}/${REPO}/${SHA}/manuscripts/sub/notes.md`,
    ]);
    expect(rawCalls.some((url) => url.includes('README.md'))).toBe(false);
    expect(rawCalls.some((url) => url.includes('huge.qmd'))).toBe(false);
  });
});

describe('loadPublicSnapshot concurrency', () => {
  it('never has more than 6 blob requests in flight and returns the eligible files', async () => {
    const entries: TreeEntry[] = Array.from({ length: 20 }, (_, index) => ({
      type: 'blob', path: `manuscripts/file-${index}.qmd`, size: 1,
    }));
    const { fetchFn, pending, maxInFlight } = createManualBlobFetch(entries);
    const promise = loadPublicSnapshot(OWNER, REPO, SHA, fetchFn as unknown as typeof fetch, {
      commit: { sha: SHA, treeSha: TREE_SHA },
    });

    await drainUntilSettled(pending, promise);
    const snapshot = await promise;

    expect(maxInFlight()).toBe(6);
    expect(snapshot.files.size).toBe(entries.length);
    expect([...snapshot.files.keys()]).toEqual(entries.map((e) => e.path));
    expect(snapshot.files.get('manuscripts/file-0.qmd')).toBe(
      `body:https://raw.githubusercontent.com/${OWNER}/${REPO}/${SHA}/manuscripts/file-0.qmd`,
    );
  });

  it('skips the commit lookup when a resolved commit is given', async () => {
    const fetchFn = snapshotFetch();

    const snapshot = await loadPublicSnapshot(
      OWNER,
      REPO,
      'main',
      fetchFn as unknown as typeof fetch,
      { commit: { sha: SHA, treeSha: TREE_SHA } },
    );

    expect(snapshot.sha).toBe(SHA);
    expect([...snapshot.files.keys()]).toEqual([
      'opendraft.yml',
      'manuscripts/chapter one.qmd',
      'manuscripts/sub/notes.md',
    ]);

    const calledUrls = fetchFn.mock.calls.map(([input]) => String(input));
    expect(calledUrls.some((url) => url.includes('/commits/'))).toBe(false);
  });
});

describe('GitHub error mapping', () => {
  it('throws NotFoundError for a 404 API answer', async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ message: 'Not Found' }, 404));

    await expect(
      resolveCommit(OWNER, REPO, 'HEAD', fetchFn as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws RateLimitedError for a 403 with an exhausted rate limit', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ message: 'API rate limit exceeded' }, 403, { 'x-ratelimit-remaining': '0' }),
    );

    await expect(
      resolveCommit(OWNER, REPO, 'HEAD', fetchFn as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(RateLimitedError);
  });

  it('throws RateLimitedError for a 429 with an exhausted rate limit', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ message: 'Too many requests' }, 429, { 'x-ratelimit-remaining': '0' }),
    );

    await expect(
      resolveCommit(OWNER, REPO, 'HEAD', fetchFn as unknown as typeof fetch),
    ).rejects.toBeInstanceOf(RateLimitedError);
  });
});

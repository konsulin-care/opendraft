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

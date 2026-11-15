import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { resolveProtocol } from '../src/resolve-protocol.js';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const A = 'a'.repeat(40);
const OLD = 'b'.repeat(40);
const NEW = 'c'.repeat(40);
const history = {
  compatibleSince: A,
  revisions: [
    { commit: A, compatible: true, files: [
      { path: 'article.shacl.ttl', sha256: sha('x') },
      { path: 'article-release.shacl.ttl', sha256: sha('y') },
    ] },
    { commit: OLD, compatible: false },
  ],
  objects: { [sha('x')]: 'x', [sha('y')]: 'y' },
};

describe('resolveProtocol', () => {
  it('resolves bundled pins without fetching', async () => {
    const fetch = vi.fn();
    const r = await resolveProtocol(A, { history, repository: 'o/r', fetch });
    expect(r.status).toBe('bundled');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches unknown pins, caches, then serves from cache', async () => {
    const store = new Map<string, string>();
    const cache = { get: (k: string) => store.get(k), set: (k: string, v: string) => void store.set(k, v) };
    const fetch = vi.fn(async (url: string) =>
      url.includes('release') ? { ok: false, status: 404, text: async () => '' } : { ok: true, status: 200, text: async () => 'z' });
    const r = await resolveProtocol(NEW, { history, repository: 'o/r', fetch, cache });
    expect(r.status).toBe('fetched');
    expect(fetch).toHaveBeenCalledWith(`https://raw.githubusercontent.com/o/r/${NEW}/protocol/article.shacl.ttl`);
    expect(store.has(`${NEW}/article.shacl.ttl`)).toBe(true);
    fetch.mockClear();
    const r2 = await resolveProtocol(NEW, { history, repository: 'o/r', fetch, cache });
    expect(r2.status).toBe('cached');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('reports unavailable and incompatible', async () => {
    expect((await resolveProtocol(NEW, { history, repository: 'o/r', offline: true })).status).toBe('unavailable');
    const failing = async () => { throw new Error('net'); };
    expect((await resolveProtocol(NEW, { history, repository: 'o/r', fetch: failing })).status).toBe('unavailable');
    expect((await resolveProtocol(OLD, { history, repository: 'o/r' })).status).toBe('incompatible');
  });
});

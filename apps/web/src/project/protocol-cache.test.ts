import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { IndexedDbProtocolCache } from './protocol-cache';

describe('IndexedDbProtocolCache', () => {
  it('returns stored value after set and null when missing', async () => {
    const cache = new IndexedDbProtocolCache();
    expect(await cache.get('abc/article.shacl.ttl')).toBeNull();
    await cache.set('abc/article.shacl.ttl', 'data');
    expect(await cache.get('abc/article.shacl.ttl')).toBe('data');
  });
});

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { FileProtocolCache } from '../src/protocol-cache';

it('stores and returns values, null when missing', async () => {
  const cache = new FileProtocolCache(mkdtempSync(join(tmpdir(), 'pc-')));
  expect(await cache.get('abc/article.shacl.ttl')).toBeNull();
  await cache.set('abc/article.shacl.ttl', 'data');
  expect(await cache.get('abc/article.shacl.ttl')).toBe('data');
});

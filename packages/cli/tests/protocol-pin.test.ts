import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveProtocol } from '@opendraft/rdf';
import { cliProtocolOptions } from '../src/protocol.js';

const BUNDLED = 'ed768fe9db8b357494a08b11871dfd1315d11833';
const UNKNOWN = 'a'.repeat(40);

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'opendraft-cli-pin-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

describe('cliProtocolOptions pin resolution', () => {
  it('resolves a bundled pin without calling fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await resolveProtocol(BUNDLED, cliProtocolOptions({ cacheDir: dir }));
    expect(result.status).toBe('bundled');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fetches an unknown pin from raw GitHub, caches it, and serves the next call from cache', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => 'content' }));
    vi.stubGlobal('fetch', fetchMock);
    const options = cliProtocolOptions({ cacheDir: dir });
    const first = await resolveProtocol(UNKNOWN, options);
    expect(first.status).toBe('fetched');
    const urls = fetchMock.mock.calls.map((c) => String((c as unknown[])[0]));
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).toContain(`https://raw.githubusercontent.com/konsulin-care/opendraft/${UNKNOWN}/protocol/`);
    }
    const calls = fetchMock.mock.calls.length;
    const second = await resolveProtocol(UNKNOWN, cliProtocolOptions({ cacheDir: dir }));
    expect(second.status).toBe('cached');
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it('resolves unavailable when offline or when fetch fails', async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 500, text: async () => '' }));
    vi.stubGlobal('fetch', fetchMock);
    const offline = await resolveProtocol(UNKNOWN, cliProtocolOptions({ offline: true, cacheDir: dir }));
    expect(offline.status).toBe('unavailable');
    expect(fetchMock).not.toHaveBeenCalled();
    const failed = await resolveProtocol(UNKNOWN, cliProtocolOptions({ cacheDir: dir }));
    expect(failed.status).toBe('unavailable');
  });
});

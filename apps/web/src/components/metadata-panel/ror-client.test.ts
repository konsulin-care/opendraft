/**
 * ROR v2 client tests: exact endpoint URL and v2 item mapping, per-query
 * caching in memory and IndexedDB (surviving a module reload), and the
 * AbortSignal plumbing that cancels stale queries.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRorCache, searchRorOrgs, type RorOrg } from './ror-client';

/** One raw v2 organization item. */
const ITEM = {
  id: 'https://ror.org/0116zj450',
  names: [{ value: 'University of Indonesia', types: ['ror_display'] }],
  addresses: [{ city: 'Depok' }],
  country: { country_code: 'ID' },
};
const PAYLOAD = { items: [ITEM] };

/** The flat record the client derives from {@link ITEM}. */
const ORG: RorOrg = {
  id: '0116zj450', name: 'University of Indonesia',
  city: 'Depok', country: 'ID', ror: 'https://ror.org/0116zj450',
};

// Fetch stub recording calls and returning the ROR payload.
function fetchStub(): ReturnType<typeof vi.fn> {
  return vi.fn(async () => ({ ok: true, status: 200, json: async () => PAYLOAD }));
}

// Fetch stub that never settles but records and honors its abort signal.
function abortingFetch(seen: AbortSignal[]): ReturnType<typeof vi.fn> {
  return vi.fn((_url: string, init?: RequestInit) => new Promise((_, reject) => {
    seen.push(init?.signal as AbortSignal);
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
  }));
}

describe('searchRorOrgs', () => {
  beforeEach(async () => { await clearRorCache(); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('queries the v2 organizations endpoint and maps items', async () => {
    const fetchFn = fetchStub();
    const items = await searchRorOrgs('univer', { fetchFn: fetchFn as typeof fetch });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0]?.[0]).toBe('https://api.ror.org/v2/organizations?query=univer');
    expect(items).toEqual([ORG]);
  });

  it('serves a repeated query from the cache', async () => {
    const fetchFn = fetchStub();
    const opts = { fetchFn: fetchFn as typeof fetch };
    await searchRorOrgs('univer', opts);
    const again = await searchRorOrgs('univer', opts);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(again).toEqual([ORG]);
  });

  it('persists results in IndexedDB across a module reload', async () => {
    await searchRorOrgs('univer', { fetchFn: fetchStub() as typeof fetch });
    vi.resetModules();
    const fresh = await import('./ror-client');
    const fetchFn = fetchStub();
    const items = await fresh.searchRorOrgs('univer', { fetchFn: fetchFn as typeof fetch });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(items).toEqual([ORG]);
  });

  it('rejects and marks the signal aborted when the caller aborts', async () => {
    const seen: AbortSignal[] = [];
    const fetchFn = abortingFetch(seen);
    const controller = new AbortController();
    const pending = searchRorOrgs('univer', {
      fetchFn: fetchFn as unknown as typeof fetch, signal: controller.signal,
    });
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalled());
    controller.abort();
    await expect(pending).rejects.toThrow('aborted');
    expect(seen[0]?.aborted).toBe(true);
  });
});

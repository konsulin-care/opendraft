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
  locations: [{ geonames_id: 1645524, geonames_details: {
    name: 'Depok', country_code: 'ID', country_name: 'Indonesia',
    country_subdivision_name: 'West Java', country_subdivision_code: 'JB',
  } }],
  links: [
    { type: 'website', value: 'https://www.ui.ac.id/' },
    { type: 'wikipedia', value: 'http://en.wikipedia.org/wiki/University_of_Indonesia' },
  ],
};
const PAYLOAD = { items: [ITEM] };

/** The flat record the client derives from {@link ITEM}. */
const ORG: RorOrg = {
  id: '0116zj450', name: 'University of Indonesia',
  city: 'Depok', region: 'West Java', country: 'ID',
  url: 'https://www.ui.ac.id/', ror: 'https://ror.org/0116zj450',
};

type FetchMock = ReturnType<typeof vi.fn>;

// Treat a mock implementation as the fetch function under test.
const asFetch = (mock: FetchMock): typeof fetch => mock as unknown as typeof fetch;

// Fetch stub recording calls and returning the ROR payload.
function fetchStub(): FetchMock {
  return vi.fn(async () => ({ ok: true, status: 200, json: async () => PAYLOAD }));
}

// Fetch stub that never settles but records and honors its abort signal.
function abortingFetch(seen: AbortSignal[]): FetchMock {
  return vi.fn((_url: string, init?: RequestInit) => new Promise((_, reject) => {
    seen.push(init?.signal as AbortSignal);
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
  }));
}

beforeEach(async () => { await clearRorCache(); });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('searchRorOrgs mapping', () => {
  it('queries the v2 organizations endpoint and maps items', async () => {
    const fetchFn = fetchStub();
    const items = await searchRorOrgs('univer', { fetchFn: asFetch(fetchFn) });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0]?.[0]).toBe('https://api.ror.org/v2/organizations?query=univer');
    expect(items).toEqual([ORG]);
  });

  it('omits location and website fields for an item without them', async () => {
    const bare = { id: 'https://ror.org/abc123', names: [{ value: 'Bare Org', types: ['ror_display'] }] };
    const fetchFn = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ items: [bare] }) }));
    const items = await searchRorOrgs('bare', { fetchFn: asFetch(fetchFn) });
    expect(items).toEqual([{ id: 'abc123', name: 'Bare Org', ror: 'https://ror.org/abc123' }]);
  });
});

describe('searchRorOrgs caching and aborts', () => {
  it('serves a repeated query from the cache', async () => {
    const fetchFn = fetchStub();
    const opts = { fetchFn: asFetch(fetchFn) };
    await searchRorOrgs('univer', opts);
    const again = await searchRorOrgs('univer', opts);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(again).toEqual([ORG]);
  });

  it('persists results in IndexedDB across a module reload', async () => {
    await searchRorOrgs('univer', { fetchFn: asFetch(fetchStub()) });
    vi.resetModules();
    const fresh = await import('./ror-client');
    const fetchFn = fetchStub();
    const items = await fresh.searchRorOrgs('univer', { fetchFn: asFetch(fetchFn) });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(items).toEqual([ORG]);
  });

  it('rejects and marks the signal aborted when the caller aborts', async () => {
    const seen: AbortSignal[] = [];
    const fetchFn = abortingFetch(seen);
    const controller = new AbortController();
    const pending = searchRorOrgs('univer', {
      fetchFn: asFetch(fetchFn), signal: controller.signal,
    });
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalled());
    controller.abort();
    await expect(pending).rejects.toThrow('aborted');
    expect(seen[0]?.aborted).toBe(true);
  });
});

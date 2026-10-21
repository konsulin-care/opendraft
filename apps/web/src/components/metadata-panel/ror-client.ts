/**
 * ROR v2 organization search client.
 *
 * Queries https://api.ror.org/v2/organizations?query=, maps the v2 item
 * shape to flat suggestion records, and caches results per query in
 * IndexedDB with an in-memory hot layer. A missing or broken IndexedDB
 * degrades to memory-only caching. Stale queries are cancelled by
 * passing an AbortSignal through to fetch.
 */

/** One ROR organization mapped to a flat suggestion record. */
export interface RorOrg {
  /** Naked ROR id, e.g. '0116zj450'. */
  id: string;
  /** Display name of the organization. */
  name: string;
  /** First address city, when present. */
  city?: string;
  /** ISO country code, e.g. 'ID'. */
  country?: string;
  /** Canonical ROR URL, e.g. 'https://ror.org/0116zj450'. */
  ror: string;
}

/** Options of {@link searchRorOrgs}. */
export interface RorSearchOptions {
  /** Abort signal; aborting rejects the search. */
  signal?: AbortSignal;
  /** Fetch implementation; defaults to the global fetch. */
  fetchFn?: typeof fetch;
}

/** Base URL of the ROR v2 organizations endpoint. */
const ROR_BASE = 'https://api.ror.org/v2/organizations';
/** Name of the IndexedDB cache database. */
const DB_NAME = 'opendraft-ror-cache';
/** Object store holding one record per query. */
const STORE = 'queries';
/** In-memory hot layer consulted before IndexedDB. */
const memory = new Map<string, RorOrg[]>();

/** Raw v2 item as returned by the ROR API. */
interface V2Item {
  id?: string;
  name?: string;
  names?: { value?: string; types?: string[] }[];
  city?: string;
  addresses?: { city?: string }[];
  country?: { country_code?: string } | string;
}

/**
 * Canonicalize any ROR id or URL to https://ror.org/<id>.
 *
 * @param value - Naked id or URL form of a ROR identifier.
 * @returns The canonical ROR URL, or '' for an empty input.
 */
export function canonicalRor(value: string): string {
  const naked = value.trim()
    .replace(/^(?:https?:\/\/)?(?:www\.)?ror\.org\//i, '')
    .replace(/\/+$/, '');
  return naked ? `https://ror.org/${naked}` : '';
}

// Pick the ror_display (else first) name of a v2 item.
function displayName(item: V2Item): string {
  const names = item.names ?? [];
  return names.find((n) => n.types?.includes('ror_display'))?.value
    ?? names[0]?.value ?? item.name ?? '';
}

// Map one raw v2 item to a flat suggestion record.
function toOrg(raw: unknown): RorOrg | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as V2Item;
  const name = displayName(item);
  const ror = canonicalRor(item.id ?? '');
  if (!ror && !name) return null;
  const city = item.addresses?.[0]?.city ?? item.city;
  const country = typeof item.country === 'string' ? item.country : item.country?.country_code;
  return {
    id: ror.replace('https://ror.org/', ''),
    name,
    ...(city ? { city } : {}),
    ...(country ? { country } : {}),
    ror,
  };
}

/**
 * Open the cache database, or null when IndexedDB is unavailable.
 *
 * @returns The database handle, resolving to null on any failure.
 */
function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// Run one request against the cache store; errors resolve to null.
async function storeOp<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result as T | undefined ?? null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    } finally {
      db.close();
    }
  });
}

// Read one cached query from IndexedDB; misses resolve to null.
function cacheGet(query: string): Promise<RorOrg[] | null> {
  return storeOp<RorOrg[]>('readonly', (store) => store.get(query));
}

// Write one query result to IndexedDB; failures are swallowed.
async function cacheSet(query: string, items: RorOrg[]): Promise<void> {
  await storeOp('readwrite', (store) => store.put(items, query));
}

/**
 * Drop the in-memory and IndexedDB query caches.
 *
 * @returns Resolves once every cache layer has been cleared.
 */
export async function clearRorCache(): Promise<void> {
  memory.clear();
  await storeOp('readwrite', (store) => store.clear());
}

/**
 * Search ROR v2 organizations for a query, serving repeated queries from
 * the cache. Results persist to IndexedDB and fall back to the in-memory
 * layer when IndexedDB is unavailable or broken. Callers enforce the
 * 5-character minimum before calling.
 *
 * @param query - Free-text search query.
 * @param options - Abort signal and fetch override; see {@link RorSearchOptions}.
 * @returns Mapped organizations in API order.
 */
export async function searchRorOrgs(
  query: string,
  options: RorSearchOptions = {},
): Promise<RorOrg[]> {
  const cached = memory.get(query) ?? await cacheGet(query);
  if (cached) {
    memory.set(query, cached);
    return cached;
  }
  const doFetch = options.fetchFn ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const response = await doFetch(`${ROR_BASE}?query=${encodeURIComponent(query)}`, {
    signal: options.signal,
  });
  if (!response.ok) throw new Error(`ROR search failed with ${response.status}`);
  const data = await response.json() as { items?: unknown[] };
  const items = (data.items ?? [])
    .map(toOrg)
    .filter((org): org is RorOrg => org !== null);
  memory.set(query, items);
  await cacheSet(query, items);
  return items;
}

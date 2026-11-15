/** One file reference in the bundled history. */
export interface ResolveFileRef {
  path: string;
  sha256: string;
}

/** Bundled protocol history (subset used for resolution). */
export interface ResolveHistory {
  compatibleSince: string;
  revisions: { commit: string; compatible: boolean; files?: ResolveFileRef[] }[];
  objects: Record<string, string>;
}

/** Key/value cache for fetched protocol files, keyed `<sha>/<path>`. */
export interface ProtocolCache {
  get(key: string): Promise<string | undefined> | string | undefined;
  set(key: string, value: string): Promise<void> | void;
}

/** Options for resolveProtocol. */
export interface ResolveProtocolOptions {
  history: ResolveHistory;
  /** `<owner>/<repo>` */
  repository: string;
  fetch?: (url: string) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;
  cache?: ProtocolCache;
  offline?: boolean;
}

/** Result of protocol resolution. */
export type ResolveProtocolResult =
  | { status: 'bundled' | 'cached' | 'fetched'; compatible: boolean; files: Record<string, string> }
  | { status: 'incompatible' }
  | { status: 'unavailable'; reason: string };

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function fromBundle(
  rev: ResolveHistory['revisions'][number],
  history: ResolveHistory,
): Promise<ResolveProtocolResult> {
  if (!rev.compatible || !rev.files) return { status: 'incompatible' };
  const files: Record<string, string> = {};
  for (const ref of rev.files) {
    const content = history.objects[ref.sha256];
    if (content === undefined || (await sha256Hex(content)) !== ref.sha256) {
      return { status: 'unavailable', reason: `bundled object for ${ref.path} failed verification` };
    }
    files[ref.path] = content;
  }
  return { status: 'bundled', compatible: true, files };
}

async function fromCache(
  pin: string,
  names: string[],
  cache: ProtocolCache,
): Promise<ResolveProtocolResult | undefined> {
  const files: Record<string, string> = {};
  let all = names.length > 0;
  for (const path of names) {
    const hit = await cache.get(`${pin}/${path}`);
    if (hit !== undefined) files[path] = hit;
    else if (!path.includes('article-release')) all = false;
  }
  if (all && Object.keys(files).length > 0) return { status: 'cached', compatible: true, files };
  return undefined;
}

/**
 * Resolves protocol files for a pinned revision: bundled (sha256-verified), cache, then fetch.
 * @param pin 40-hex commit SHA.
 * @param options history, repository, fetch, cache, offline.
 * @returns files by path with status, or incompatible / unavailable.
 */
export async function resolveProtocol(
  pin: string,
  options: ResolveProtocolOptions,
): Promise<ResolveProtocolResult> {
  const { history, cache } = options;
  const rev = history.revisions.find((r) => r.commit === pin);
  if (rev) return fromBundle(rev, history);
  const names = (history.revisions.find((r) => r.files)?.files ?? []).map((f) => f.path);
  if (cache) {
    const hit = await fromCache(pin, names, cache);
    if (hit) return hit;
  }
  if (options.offline) return { status: 'unavailable', reason: `revision ${pin} is not available offline` };
  if (!options.fetch) return { status: 'unavailable', reason: 'no fetch available' };
  return fetchAll(pin, names, options, options.fetch);
}

async function fetchAll(
  pin: string,
  names: string[],
  options: ResolveProtocolOptions,
  fetchFn: NonNullable<ResolveProtocolOptions['fetch']>,
): Promise<ResolveProtocolResult> {
  const { repository, cache } = options;
  const files: Record<string, string> = {};
  for (const path of names) {
    const url = `https://raw.githubusercontent.com/${repository}/${pin}/${path.startsWith('protocol/') ? path : `protocol/${path}`}`;
    try {
      const res = await fetchFn(url);
      if (!res.ok) {
        if (res.status === 404 && path.includes('article-release')) continue;
        return { status: 'unavailable', reason: `fetch ${url} failed with ${res.status}` };
      }
      const text = await res.text();
      files[path] = text;
      await cache?.set(`${pin}/${path}`, text);
    } catch (e) {
      return { status: 'unavailable', reason: `fetch ${url} failed: ${String(e)}` };
    }
  }
  return { status: 'fetched', compatible: true, files };
}

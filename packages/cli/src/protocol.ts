/**
 * Protocol helpers for the OpenDraft CLI: `BUNDLED_PROTOCOL_LATEST` (pin for
 * new projects) and `cliProtocolOptions` (resolveProtocol options).
 */

import type { ResolveHistory, ResolveProtocolOptions } from '@opendraft/rdf';
import history from '../../rdf/src/protocol-history.generated.json';
import { FileProtocolCache } from './protocol-cache.js';

/** Latest protocol revision in the bundled history; the pin for new projects. */
export const BUNDLED_PROTOCOL_LATEST: string = (history as unknown as { latest: string }).latest;

/**
 * Build resolveProtocol options for the CLI: bundled history, file cache, global fetch.
 *
 * @param opts - offline flag and optional cache directory.
 * @returns options for resolveProtocol.
 */
export function cliProtocolOptions(opts: {
  offline?: boolean;
  cacheDir?: string;
}): ResolveProtocolOptions {
  const file = new FileProtocolCache(opts.cacheDir);
  return {
    history: history as unknown as ResolveHistory,
    repository: 'konsulin-care/opendraft',
    cache: {
      get: async (key) => (await file.get(key)) ?? undefined,
      set: (key, value) => file.set(key, value),
    },
    fetch: (url) => fetch(url),
    offline: opts.offline ?? false,
  };
}

/**
 * Protocol pin for the OpenDraft CLI: the protocol commit embedded at
 * build time and the check that compares it against `opendraft.yml`.
 */

import type { ResolveHistory, ResolveProtocolOptions } from '@opendraft/rdf';
import history from '../../rdf/src/protocol-history.generated.json';
import type { Finding } from './output.js';
import { FileProtocolCache } from './protocol-cache.js';

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

/**
 * Protocol commit embedded from `protocol/protocol.manifest.json`
 * (`protocol.commit`). Kept in sync by the protocol-pin test.
 */
export const EMBEDDED_PROTOCOL_COMMIT = 'ed768fe9db8b357494a08b11871dfd1315d11833';

/**
 * Compare a project's pinned protocol commit against the embedded one.
 *
 * A mismatch pushes a warning finding onto the collector; warnings never
 * change the validate exit code.
 *
 * @param commit - `protocol.commit` read from opendraft.yml.
 * @param findings - Collector pushed onto when the commits differ.
 */
export function checkProtocolPin(commit: string, findings: Finding[]): void {
  if (commit === EMBEDDED_PROTOCOL_COMMIT) return;
  findings.push({
    level: 'warning',
    location: 'opendraft.yml',
    path: 'protocol.commit',
    message: `protocol commit ${commit} does not match the embedded protocol commit ${EMBEDDED_PROTOCOL_COMMIT}`,
  });
}

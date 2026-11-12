/**
 * Protocol pin for the OpenDraft CLI: the protocol commit embedded at
 * build time and the check that compares it against `opendraft.yml`.
 */

import type { Finding } from './output.js';

/**
 * Protocol commit embedded from `protocol/protocol.manifest.json`
 * (`protocol.commit`). Kept in sync by the protocol-pin test.
 */
export const EMBEDDED_PROTOCOL_COMMIT = 'f192c95d750b6a71b49134819b08aec509790c84';

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

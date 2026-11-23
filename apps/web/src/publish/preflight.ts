/**
 * Preflight validation for publishing and sending drafts.
 *
 * Wraps `validateProject` with the browser protocol cache and fetch, drops
 * informational findings, and separates blocking errors from warnings.
 */

import type { RdfStageOptions, Finding } from '@opendraft/validate';
import { validateProject } from '@opendraft/validate';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { IndexedDbProtocolCache } from '../project/protocol-cache';

/** Validation options accepted by {@link preflight}; cache and fetch are injected. */
export type PreflightOptions = Omit<RdfStageOptions, 'cache' | 'fetch'>;

/** Result of {@link preflight}. */
export interface PreflightResult {
  /** True when no blocking error findings were reported. */
  ok: boolean;
  /** Blocking findings; an empty list means the action may proceed. */
  errors: Finding[];
  /** Non-blocking findings; informational findings are omitted. */
  warnings: Finding[];
}

/**
 * Validate a workspace before an action that writes to GitHub.
 *
 * @param workspace - Workspace to validate.
 * @param opts - Validation and protocol resolution options.
 * @returns Separated errors and warnings, with `ok` derived from the errors.
 */
export async function preflight(
  workspace: WorkspaceAdapter,
  opts: PreflightOptions = {},
): Promise<PreflightResult> {
  const findings = await validateProject(workspace, {
    ...opts,
    cache: new IndexedDbProtocolCache(),
    fetch: (url: string) => fetch(url),
  } as RdfStageOptions);
  const errors = findings.filter((finding) => finding.level === 'error');
  const warnings = findings.filter((finding) => finding.level === 'warning');
  return { ok: errors.length === 0, errors, warnings };
}

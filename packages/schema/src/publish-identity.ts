/** A single remedy offered when publishing is blocked by a repository mismatch. */
export type RepositoryMismatchRemedy = 'pull-request' | 'publish-independently';

/** Result: publish from the registered repository with no concept DOI yet — mint a new Work. */
export interface NewWorkIdentity {
  kind: 'new-work';
}

/** Result: same Work, new published version — mint a version DOI only. */
export interface NewVersionIdentity {
  kind: 'new-version';
  conceptDoi: string;
}

/** Result: current repository differs from the registered one — publish blocked with remedies. */
export interface RepositoryMismatchIdentity {
  kind: 'repository-mismatch';
  remedies: RepositoryMismatchRemedy[];
}

/** Result: configuration is internally inconsistent (fork kept a foreign concept DOI). */
export interface IntegrityErrorIdentity {
  kind: 'integrity-error';
  code: 'concept-doi-bound-to-other-repository';
}

/** Discriminated union of all publish identity outcomes (fork rule). */
export type PublishIdentity =
  | NewWorkIdentity
  | NewVersionIdentity
  | RepositoryMismatchIdentity
  | IntegrityErrorIdentity;

/** Inputs to the fork / publish identity rule. */
export interface PublishIdentityInput {
  /** Registered original repository URL from opendraft.yml (may be absent). */
  repository?: string | null;
  /** Repository URL the publish is actually running from. */
  currentRepositoryUrl?: string | null;
  /** Concept DOI recorded for the manuscript, if one was minted at first publish. */
  conceptDoi?: string | null;
  /** Repository URL at which the concept DOI was minted, if recorded. */
  conceptDoiRepository?: string | null;
}

/**
 * Normalize a repository URL for comparison under the fork rule.
 *
 * Trailing slashes, a `.git` suffix, the http/https scheme difference and
 * letter case are ignored; `git@github.com:` SSH hosts are not handled here.
 *
 * @param url - Repository URL, possibly sloppy (`.git`, trailing `/`, `http`).
 * @returns Canonical comparison string (scheme-less, lowercase, no `.git`).
 */
export function normalizeRepositoryUrl(url: string): string {
  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '');
}

/**
 * Trim string inputs; non-strings normalize to the empty string.
 */
function str(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Resolve the publish identity for a manuscript under the fork rule.
 *
 * Publishing is allowed only when the normalized current repository URL
 * equals the registered `repository`. Outcomes:
 * - URLs differ -> `repository-mismatch` with two remedies (PR upstream, or
 *   re-register the fork and clear every concept DOI).
 * - URLs match, concept DOI is bound to a different repository -> integrity error.
 * - URLs match, concept DOI present -> new version of the same Work.
 * - URLs match, no concept DOI -> new Work.
 *
 * @param input - Registered repository, current repository and concept DOI state.
 * @returns The discriminated publish identity outcome.
 */
export function resolvePublishIdentity(input: PublishIdentityInput): PublishIdentity {
  const registered = normalizeRepositoryUrl(str(input.repository));
  const current = normalizeRepositoryUrl(str(input.currentRepositoryUrl));
  const conceptDoi = str(input.conceptDoi);
  const conceptDoiRepository = str(input.conceptDoiRepository);

  if (registered !== current) {
    return { kind: 'repository-mismatch', remedies: ['pull-request', 'publish-independently'] };
  }
  if (
    conceptDoi &&
    conceptDoiRepository &&
    normalizeRepositoryUrl(conceptDoiRepository) !== current
  ) {
    return { kind: 'integrity-error', code: 'concept-doi-bound-to-other-repository' };
  }
  if (conceptDoi) {
    return { kind: 'new-version', conceptDoi };
  }
  return { kind: 'new-work' };
}

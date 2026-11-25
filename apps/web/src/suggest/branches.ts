/**
 * Suggestion branch naming.
 *
 * Drafts live under `od-<login>/<slug>`. Legacy suggestions used
 * `opendraft/<login>/`; both prefixes are still recognised when resuming.
 */

/** Placeholder slug used until the draft gets its real name at first save. */
export const PLACEHOLDER = 'untitled-draft';

/**
 * Build the branch prefix that belongs to a viewer.
 *
 * @param login - GitHub login of the suggestion author.
 * @returns Branch prefix ending with a slash.
 */
export function suggestionPrefix(login: string): string {
  return `opendraft/${login}/`;
}

/** Pad a number to at least two digits. */
function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

/**
 * Format a date as a UTC `YYYYMMDD-HHmmss` timestamp.
 *
 * @param date - Date to format.
 * @returns Compact UTC timestamp.
 */
function formatUtcTimestamp(date: Date): string {
  const year = date.getUTCFullYear().toString().padStart(4, '0');
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

/**
 * Build the suggestion branch name for a viewer at a point in time.
 *
 * The timestamp is always UTC, so branch names sort chronologically
 * regardless of the viewer's timezone.
 *
 * @param login - GitHub login of the suggestion author.
 * @param date - Time the suggestion starts.
 * @returns Branch name `opendraft/<login>/<YYYYMMDD-HHmmss>`.
 */
export function suggestionBranch(login: string, date: Date): string {
  return `${suggestionPrefix(login)}${formatUtcTimestamp(date)}`;
}

/**
 * Find the greatest suggestion branch belonging to a viewer.
 *
 * Branch names encode a UTC timestamp, so the lexicographically greatest
 * name under the viewer's prefix is also the most recent suggestion.
 *
 * @param names - Branch names to search.
 * @param login - GitHub login of the suggestion author.
 * @returns The greatest matching branch name, or `null` when none match.
 */
export function latestBranch(names: Iterable<string>, login: string): string | null {
  const prefix = suggestionPrefix(login);
  let latest: string | null = null;

  for (const name of names) {
    if (!name.startsWith(prefix) || name.length === prefix.length) {
      continue;
    }

    if (latest === null || name > latest) {
      latest = name;
    }
  }

  return latest;
}

/**
 * Build the draft branch prefix that belongs to a viewer.
 *
 * @param login - GitHub login of the draft author.
 * @returns Branch prefix `od-<login>/` with the login lowercased.
 */
export function draftPrefix(login: string): string {
  return `od-${login.toLowerCase()}/`;
}

/**
 * Turn a draft name into a branch-safe slug.
 *
 * The slug is lowercase and keeps only `a-z`, `0-9` and single hyphens. Any
 * other character, including `/`, separates words.
 *
 * @param name - Human readable draft name.
 * @returns Slug without leading or trailing hyphens.
 */
export function draftSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Build the full draft branch name for a viewer and draft name.
 *
 * @param login - GitHub login of the draft author.
 * @param name - Human readable draft name.
 * @returns Branch name `od-<login>/<slug>`.
 */
export function draftBranch(login: string, name: string): string {
  return `${draftPrefix(login)}${draftSlug(name)}`;
}

/** Result of checking whether a draft branch name is available. */
export type DraftNameStatus =
  | { kind: 'free' }
  | { kind: 'taken'; alternative: string }
  | { kind: 'blocked' };

/**
 * Check whether a draft slug is available for a viewer.
 *
 * A branch named exactly `od-<login>` (no slug segment) blocks drafting
 * because it shadows the viewer's prefix. Otherwise a taken slug reports the
 * next free numbered alternative.
 *
 * @param refs - Remote branch names to check against.
 * @param login - GitHub login of the draft author.
 * @param slug - Draft slug to check, already branch-safe.
 * @returns Free, taken with an alternative, or blocked status.
 */
export function draftNameStatus(
  refs: Iterable<string>,
  login: string,
  slug: string,
): DraftNameStatus {
  const names = new Set(refs);
  const loginSlug = login.toLowerCase();

  if (names.has(`od-${loginSlug}`)) {
    return { kind: 'blocked' };
  }

  const prefix = draftPrefix(login);
  if (!names.has(`${prefix}${slug}`)) {
    return { kind: 'free' };
  }

  let suffix = 2;
  while (names.has(`${prefix}${slug}-${suffix}`)) {
    suffix += 1;
  }

  return { kind: 'taken', alternative: `${slug}-${suffix}` };
}

/**
 * Find the viewer's own draft branch, preferring the new `od-` prefix.
 *
 * Only branches under `od-<login>/` or the legacy `opendraft/<login>/` are
 * considered, so another user's `od-*` branches never match.
 *
 * @param refs - Branch names to search.
 * @param login - GitHub login of the viewer.
 * @returns The most recent matching branch name, or `null` when none match.
 */
export function findOwnDraft(refs: Iterable<string>, login: string): string | null {
  const names = Array.from(refs);
  const prefixes = [draftPrefix(login), suggestionPrefix(login)];

  for (const prefix of prefixes) {
    let latest: string | null = null;

    for (const name of names) {
      if (!name.startsWith(prefix) || name.length === prefix.length) {
        continue;
      }

      if (latest === null || name > latest) {
        latest = name;
      }
    }

    if (latest !== null) {
      return latest;
    }
  }

  return null;
}

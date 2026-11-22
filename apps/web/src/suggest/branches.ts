/**
 * Suggestion branch naming.
 *
 * Every suggestion lives on a branch under `opendraft/<login>/` so the reader
 * can find and resume the latest suggestion for a viewer.
 */

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

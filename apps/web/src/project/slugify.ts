/** Fallback identifier when a name produces no valid slug. */
const FALLBACK_ID = 'manuscript';

/** Valid manuscript identifier pattern (mirrors the protocol schema). */
const MANUSCRIPT_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Convert a human-readable name into a valid manuscript identifier.
 *
 * Lowercases the name, replaces every run of non-alphanumeric characters
 * with a single hyphen, and trims leading/trailing hyphens. When nothing
 * valid remains (e.g. "!!!"), falls back to "manuscript".
 *
 * @param name - Raw display name, e.g. "My First Paper!".
 * @returns A slug matching `^[a-z0-9]+(-[a-z0-9]+)*$`.
 */
export function toManuscriptId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? FALLBACK_ID : slug;
}

/**
 * Check whether a string is a valid manuscript identifier.
 *
 * @param id - Candidate identifier.
 * @returns True when the id matches `^[a-z0-9]+(-[a-z0-9]+)*$`.
 */
export function isValidManuscriptId(id: string): boolean {
  return MANUSCRIPT_ID_PATTERN.test(id);
}

/**
 * Short-name slug utilities for manuscripts.
 *
 * `normalizeShortName` turns a human-readable title into a kebab-case short
 * name: NFKD decomposition, combining marks stripped, lowercased, runs of
 * non-alphanumerics collapsed to single hyphens, capped at 40 characters,
 * with a `section` fallback. `uniqueShortName` handles duplicates by
 * appending a 6-char numeric suffix (truncating the title part so the
 * total stays within 40 characters) and regenerating the suffix on
 * collision.
 */

/** Maximum length of a short name, including any duplicate suffix. */
const MAX_SHORT_NAME = 40;

/** Short name used when normalization leaves nothing valid. */
const FALLBACK_SHORT_NAME = 'section';

/** Number of digits in a duplicate suffix. */
const SUFFIX_LENGTH = 6;

/**
 * Generate a fresh 6-digit random suffix.
 *
 * Reads CSPRNG bytes and maps each to a decimal digit so consecutive
 * suffixes differ even within the same millisecond.
 *
 * @returns Six decimal digits.
 */
function randomSuffix(): string {
  const bytes = new Uint8Array(SUFFIX_LENGTH);
  crypto.getRandomValues(bytes);
  let suffix = '';
  for (const byte of bytes) {
    suffix += byte % 10;
  }
  return suffix;
}

/**
 * Normalize a title into a short name.
 *
 * Decomposes to NFKD, strips combining marks so accents disappear
 * (`'Café RÉsumé'` becomes `'cafe-resume'`), lowercases, replaces every run
 * of non-alphanumeric characters with a single hyphen, trims edge hyphens,
 * and caps the result at 40 characters (never ending on a hyphen).
 *
 * @param title - Raw human-readable title.
 * @returns A kebab-case short name of at most 40 characters;
 *          `'section'` when normalization yields an empty string.
 */
export function normalizeShortName(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SHORT_NAME)
    .replace(/-+$/, '');
  return slug === '' ? FALLBACK_SHORT_NAME : slug;
}

/**
 * Derive a free short name for a title, de-duplicating against taken names.
 *
 * Returns the normalized title when it is not taken. When taken, appends
 * `'-<6 digits>'` to the title part, truncating the title part (and any
 * hyphen it would end on) so the total stays within 40 characters. If the
 * suffixed candidate collides again, a new suffix is generated until one
 * is free.
 *
 * @param title - Raw human-readable title to derive the short name from.
 * @param isTaken - Predicate reporting whether a candidate is already used.
 * @param nextSuffix - Suffix generator; defaults to `randomSuffix`.
 * @returns A unique short name of at most 40 characters.
 */
export function uniqueShortName(
  title: string,
  isTaken: (candidate: string) => boolean,
  nextSuffix: () => string = randomSuffix,
): string {
  const candidate = normalizeShortName(title);
  let name = candidate;
  while (isTaken(name)) {
    const suffix = `-${nextSuffix()}`;
    const base = candidate
      .slice(0, Math.max(0, MAX_SHORT_NAME - suffix.length))
      .replace(/-+$/, '');
    name = `${base}${suffix}`;
  }
  return name;
}

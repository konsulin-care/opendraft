/**
 * Quarto cross-reference label prefixes.
 *
 * These are the label kinds Quarto recognises (`@fig-…`, `@tbl-…`,
 * `@sec-…` and so on). A citation key that starts with one of them is
 * ambiguous with a cross-reference and is flagged in the UI.
 */
export const QUARTO_CROSSREF_PREFIXES = [
  'fig',
  'tbl',
  'lst',
  'tip',
  'nte',
  'wrn',
  'imp',
  'cau',
  'thm',
  'lem',
  'cor',
  'prp',
  'cnj',
  'def',
  'exm',
  'exr',
  'sol',
  'rem',
  'eq',
  'sec',
] as const;

/**
 * `@`-key pattern for a cross-reference label: a prefix, a hyphen and a
 * non-empty label body.
 */
const CROSSREF_KEY_PATTERN = new RegExp(`^(${QUARTO_CROSSREF_PREFIXES.join('|')})-.+`);

/**
 * Test whether a key is a Quarto cross-reference label.
 *
 * The first letter is lowercased because Quarto accepts both `@Fig-x`
 * and `@fig-x`. The key must then match `<prefix>-<label>`; bare
 * prefixes (`fig`) and keys that merely start with a prefix
 * (`figueroa2020`) are not cross-references.
 *
 * @param key - Candidate `@` key, without the leading `@`.
 * @returns `true` when the key denotes a cross-reference label.
 */
export function isCrossrefKey(key: string): boolean {
  if (key === '') return false;
  const normalized = key.charAt(0).toLowerCase() + key.slice(1);
  return CROSSREF_KEY_PATTERN.test(normalized);
}

/**
 * Manuscript id: lowercase kebab, no edge hyphens or repeated separators.
 */
export const MANUSCRIPT_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Block short name: lowercase alnum/kebab, no edge hyphen, max 40 chars.
 */
export const SHORT_NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

/**
 * Matches a prefixed Quarto include on its own line, capturing the short name:
 * `{{< include blocks/_<short>.qmd >}}`.
 */
export const BLOCK_INCLUDE_RE =
  /^\{\{< include blocks\/_([a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?)\.qmd >\}\}$/;

/** The 26 section-level DEO roles, in canonical order. */
export const SECTION_ROLES: readonly string[] = [
  'introduction',
  'methods',
  'results',
  'discussion',
  'conclusion',
  'acknowledgements',
  'author-contribution',
  'background',
  'biography',
  'contribution',
  'data',
  'dataset-description',
  'dedication',
  'epilogue',
  'evaluation',
  'external-resource-description',
  'future-work',
  'materials',
  'model',
  'motivation',
  'postscript',
  'problem-statement',
  'prologue',
  'related-work',
  'scenario',
  'supplementary-information-description',
];

/**
 * Strip any directory portion from a path.
 *
 * @param file - File name or path.
 * @returns The basename.
 */
function baseName(file: string): string {
  const idx = file.lastIndexOf('/');
  return idx === -1 ? file : file.slice(idx + 1);
}

/**
 * Build the block file name for a short name.
 *
 * @param short - Block short name (no underscore).
 * @returns `_<short>.qmd`.
 */
export function blockFileName(short: string): string {
  return `_${short}.qmd`;
}

/**
 * Parse a block file name back to its short name.
 *
 * Only `_<short>.qmd` with a short matching SHORT_NAME_PATTERN parses;
 * anything else (legacy unprefixed names, invalid shorts) yields null.
 *
 * @param file - Block file name or path.
 * @returns The short name, or null when the name is not `_<short>.qmd`.
 */
export function parseBlockFileName(file: string): string | null {
  const match = /^_(.+)\.qmd$/.exec(baseName(file));
  if (!match) return null;
  const short = match[1];
  return SHORT_NAME_PATTERN.test(short) ? short : null;
}

/**
 * Parse a legacy (un-prefixed) block file name to its short name.
 *
 * @param file - Block file name or path.
 * @returns The short name, or null when the name is not `<short>.qmd`.
 */
export function legacyBlockShort(file: string): string | null {
  const match = /^(.+)\.qmd$/.exec(baseName(file));
  if (!match) return null;
  const short = match[1];
  return SHORT_NAME_PATTERN.test(short) ? short : null;
}

/**
 * Build the Quarto include shortcode for a block.
 *
 * @param short - Block short name.
 * @returns `{{< include blocks/_<short>.qmd >}}`.
 */
export function includeLine(short: string): string {
  return `{{< include blocks/_${short}.qmd >}}`;
}

/**
 * Build the section anchor id for a short name.
 *
 * @param short - Block short name.
 * @returns `sec-<short>`.
 */
export function sectionAnchor(short: string): string {
  return `sec-${short}`;
}

/**
 * Map a section role to its heading CSS class.
 *
 * @param role - A SECTION_ROLES entry, or null for a plain section.
 * @returns `deo-<role>` for a role, `doco-section` for null.
 */
export function sectionClass(role: string | null): string {
  return role ? `deo-${role}` : 'doco-section';
}

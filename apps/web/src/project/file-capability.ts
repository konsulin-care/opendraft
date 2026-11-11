/** Capability of a workspace file as seen by the editor. */
export type FileCapability = 'rich' | 'text' | 'binary';

/** Valid slug stem: lowercase kebab, no edge hyphens, at most 40 chars. */
const SLUG_STEM = '[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?';

/** Manuscript block file: manuscripts/<id>/blocks/<slug>.qmd. */
const BLOCK_PATH_RE = new RegExp(`^manuscripts/[^/]+/blocks/${SLUG_STEM}\\.qmd$`);

/** Manuscript assembly file: manuscripts/<id>/article.qmd. */
const ARTICLE_PATH_RE = /^manuscripts\/[^/]+\/article\.qmd$/;

/** Maximum share of control characters (excluding \t, \n, \r) before a file counts as binary. */
const CONTROL_CHAR_THRESHOLD = 0.1;

/**
 * Report whether a path is a manuscript block file: `manuscripts/<id>/blocks/`
 * followed by a valid slug stem (lowercase kebab, no edge hyphens) and a
 * `.qmd` extension.
 *
 * @param path - Repo-relative file path.
 * @returns True when the path matches the block-file shape exactly.
 */
export function isManuscriptBlockPath(path: string): boolean {
  return BLOCK_PATH_RE.test(path);
}

/**
 * Report whether a path is a manuscript assembly file:
 * `manuscripts/<id>/article.qmd`. Assemblies mount the block editor.
 *
 * @param path - Repo-relative file path.
 * @returns True when the path is a manuscript's article.qmd.
 */
export function isManuscriptArticlePath(path: string): boolean {
  return ARTICLE_PATH_RE.test(path);
}

/**
 * Report whether a file should open in the rich editor, as plain text, or not at all.
 *
 * Content containing a NUL character, or where more than 10% of the characters
 * are control characters other than `\t`, `\n` and `\r`, is `binary`. Manuscript
 * block files (`manuscripts/<id>/blocks/<slug>.qmd`) and manuscript assemblies
 * (`manuscripts/<id>/article.qmd`) are `rich`; everything else — root
 * `.md`/`.qmd`, root `article.qmd`, `.yml`, `.bib` — is `text` and opens in the
 * source editor.
 *
 * @param path - Repo-relative file path.
 * @param content - Full file content.
 * @returns `'rich'`, `'text'` or `'binary'`.
 */
export function getFileCapability(path: string, content: string): FileCapability {
  if (isBinaryContent(content)) return 'binary';
  if (isManuscriptBlockPath(path) || isManuscriptArticlePath(path)) return 'rich';
  return 'text';
}

/**
 * Detect binary content by NUL bytes and dense control characters.
 *
 * @param content - Full file content.
 * @returns True when the content should be treated as binary.
 */
function isBinaryContent(content: string): boolean {
  if (content.includes('\u0000')) return true;
  let control = 0;
  for (const char of content) {
    const code = char.charCodeAt(0);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) control += 1;
  }
  return content.length > 0 && control / content.length > CONTROL_CHAR_THRESHOLD;
}

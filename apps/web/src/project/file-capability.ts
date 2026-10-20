/** Capability of a workspace file as seen by the editor. */
export type FileCapability = 'rich' | 'text' | 'binary';

/** Manuscript block file: manuscripts/<id>/blocks/<26-char lowercase ULID>.qmd. */
const BLOCK_PATH_RE = /^manuscripts\/[^/]+\/blocks\/[0-9abcdefghjkmnpqrstvwxyz]{26}\.qmd$/;

/** Maximum share of control characters (excluding \t, \n, \r) before a file counts as binary. */
const CONTROL_CHAR_THRESHOLD = 0.1;

/**
 * Report whether a path is a manuscript block file: `manuscripts/<id>/blocks/`
 * followed by a 26-character lowercase Crockford ULID and a `.qmd` extension.
 * These are the only files that may mount the rich visual editor.
 *
 * @param path - Repo-relative file path.
 * @returns True when the path matches the block-file shape exactly.
 */
export function isManuscriptBlockPath(path: string): boolean {
  return BLOCK_PATH_RE.test(path);
}

/**
 * Report whether a file should open in the rich editor, as plain text, or not at all.
 *
 * Content containing a NUL character, or where more than 10% of the characters
 * are control characters other than `\t`, `\n` and `\r`, is `binary`. Only
 * manuscript block files (`manuscripts/<id>/blocks/<ULID>.qmd`) are `rich`;
 * everything else — root `.md`/`.qmd`, `article.qmd`, `.yml`, `.bib` — is
 * `text` and opens in the source editor.
 *
 * @param path - Repo-relative file path.
 * @param content - Full file content.
 * @returns `'rich'`, `'text'` or `'binary'`.
 */
export function getFileCapability(path: string, content: string): FileCapability {
  if (isBinaryContent(content)) return 'binary';
  if (isManuscriptBlockPath(path)) return 'rich';
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

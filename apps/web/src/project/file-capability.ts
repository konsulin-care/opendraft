/** Capability of a workspace file as seen by the editor. */
export type FileCapability = 'rich' | 'text' | 'binary';

/** File extensions that get the rich visual editor. */
const RICH_EXTENSIONS = new Set(['md', 'qmd']);

/** Maximum share of control characters (excluding \t, \n, \r) before a file counts as binary. */
const CONTROL_CHAR_THRESHOLD = 0.1;

/**
 * Report whether a file should open in the rich editor, as plain text, or not at all.
 *
 * Content containing a NUL character, or where more than 10% of the characters
 * are control characters other than `\t`, `\n` and `\r`, is `binary`. Files with
 * a `.md` or `.qmd` extension (case-insensitive) are `rich`. Everything else is
 * `text`.
 *
 * @param path - Repo-relative file path.
 * @param content - Full file content.
 * @returns `'rich'`, `'text'` or `'binary'`.
 */
export function getFileCapability(path: string, content: string): FileCapability {
  if (isBinaryContent(content)) return 'binary';
  if (RICH_EXTENSIONS.has(extensionOf(path))) return 'rich';
  return 'text';
}

/**
 * Extract the lowercase extension of a path (without the dot).
 *
 * @param path - Repo-relative file path.
 * @returns The extension in lowercase, or an empty string when there is none.
 */
function extensionOf(path: string): string {
  const segment = path.split('/').pop() ?? '';
  const dot = segment.lastIndexOf('.');
  return dot <= 0 ? '' : segment.slice(dot + 1).toLowerCase();
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

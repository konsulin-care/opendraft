/**
 * Citekey extraction from manuscript markdown.
 *
 * `extractCitekeys` scans markdown for Pandoc-style citations — `@key`,
 * `[@key]`, `[-@key]` and `[@a; @b]` — and returns the keys in order of
 * first appearance, de-duplicated. Quarto cross-reference labels
 * (`@sec-`, `@tbl-`, `@fig-`, `@eq-`) are not citations and are dropped,
 * as are email addresses and anything inside inline or fenced code.
 */

/**
 * A citation `@` followed by its key: the `@` must not directly follow a
 * word character or a dot, which rules out emails such as `jane@example.org`
 * while still allowing `@key`, `[@key]`, `[-@key]` and `[@a; @b]`.
 */
const CITEKEY_PATTERN = /(?<![\w.])@([A-Za-z0-9_][A-Za-z0-9_:.%+#~$&/?-]*)/g;

/** Quarto cross-reference label prefixes, which never denote a citation. */
const CROSS_REFERENCE_PREFIX = /^(sec|tbl|fig|eq)-/;

/** Trailing sentence punctuation that is never part of a citation key. */
const TRAILING_PUNCTUATION = /[.:-]+$/;

/**
 * Blank out fenced code blocks, preserving the remaining line structure.
 *
 * Tracks ``` / ~~~ fences line by line: every line inside a fence becomes
 * an empty line, so citations in code never reach the extraction pass.
 *
 * @param markdown - Raw markdown text.
 * @returns The same text with all fenced code block lines emptied.
 */
function stripFencedCode(markdown: string): string {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let fence: { char: string; length: number } | null = null;
  for (const line of lines) {
    const match = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (fence === null) {
      if (match !== null) {
        fence = { char: match[1][0], length: match[1].length };
        out.push('');
        continue;
      }
      out.push(line);
      continue;
    }
    const closing = match !== null
      && match[1][0] === fence.char
      && match[1].length >= fence.length
      && /^[ \t]*$/.test(line.slice(match[0].length));
    if (closing) fence = null;
    out.push('');
  }
  return out.join('\n');
}

/**
 * Blank out inline code spans.
 *
 * Replaces every equal-run backtick span (`` `code` ``) with a single
 * space so `@` inside inline code is never extracted, without gluing the
 * surrounding words together.
 *
 * @param text - Markdown text with fenced code already removed.
 * @returns The text with all inline code spans replaced by a space.
 */
function stripInlineCode(text: string): string {
  return text.replace(/(`+)[^`]+?\1(?!`)/g, ' ');
}

/**
 * Extract citation keys from markdown.
 *
 * Matches Pandoc-style citations — `@key`, `[@key]`, `[-@key]` and
 * `[@a; @b]` — after removing fenced and inline code. Email addresses
 * (an `@` directly preceded by a word character or dot) and Quarto
 * cross-reference labels (`@sec-…`, `@tbl-…`, `@fig-…`, `@eq-…`) are
 * ignored. Keys are returned in order of first appearance, without
 * duplicates, and without trailing sentence punctuation.
 *
 * @param markdown - Raw markdown text to scan.
 * @returns One entry per distinct citation key, in order of first
 *          appearance; empty when the text contains no citations.
 */
export function extractCitekeys(markdown: string): string[] {
  const text = stripInlineCode(stripFencedCode(markdown));
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(CITEKEY_PATTERN)) {
    const key = match[1].replace(TRAILING_PUNCTUATION, '');
    if (key === '' || CROSS_REFERENCE_PREFIX.test(key) || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

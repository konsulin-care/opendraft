/**
 * Citekey extraction from manuscript markdown.
 *
 * `extractCitekeys` scans markdown for Pandoc-style citations — `@key`,
 * `[@key]`, `[-@key]` and `[@a; @b]` — and returns the keys in order of
 * first appearance, de-duplicated. Quarto cross-reference labels
 * (`@sec-`, `@tbl-`, `@fig-`, `@eq-`) are not citations and are dropped,
 * as are email addresses and anything inside inline or fenced code.
 */

import { blankCode } from './code-segments.js';
import { isCrossrefKey } from './crossref-prefixes.js';

/**
 * A citation `@` followed by its key: the `@` must not directly follow a
 * word character or a dot, which rules out emails such as `jane@example.org`
 * while still allowing `@key`, `[@key]`, `[-@key]` and `[@a; @b]`.
 */
const CITEKEY_PATTERN = /(?<![\w.])@([A-Za-z0-9_][A-Za-z0-9_:.%+#~$&/?-]*)/g;

/** Trailing sentence punctuation that is never part of a citation key. */
const TRAILING_PUNCTUATION = /[.:-]+$/;

/**
 * Extract citation keys from markdown.
 *
 * Matches Pandoc-style citations — `@key`, `[@key]`, `[-@key]` and
 * `[@a; @b]` — after removing fenced and inline code. Email addresses
 * (an `@` directly preceded by a word character or dot) and Quarto
 * cross-reference labels (`@sec-…`, `@tbl-…`, `@fig-…`, `@eq-…` and the
 * other Quarto prefixes) are ignored. Keys are returned in order of first
 * appearance, without duplicates, and without trailing sentence punctuation.
 *
 * @param markdown - Raw markdown text to scan.
 * @returns One entry per distinct citation key, in order of first
 *          appearance; empty when the text contains no citations.
 */
export function extractCitekeys(markdown: string): string[] {
  const text = blankCode(markdown);
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const match of text.matchAll(CITEKEY_PATTERN)) {
    const key = match[1].replace(TRAILING_PUNCTUATION, '');
    if (key === '' || isCrossrefKey(key) || seen.has(key)) continue;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

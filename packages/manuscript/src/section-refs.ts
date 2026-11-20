/**
 * Rewrite and count Quarto section cross-reference keys in prose.
 *
 * References use Pandoc key boundaries: a key ends at whitespace, markup
 * punctuation or the start of another key fragment, so `@sec-ab` is not a
 * match for `@sec-a`. Fenced and inline code are always emitted untouched.
 */

import { splitCodeSegments } from './code-segments.js';

/** Escape a string so it can be embedded literally in a regular expression. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Build the boundary-aware section reference pattern for one short name. */
function sectionRefPattern(short: string): RegExp {
  return new RegExp(
    `(?<![\\w.])@([Ss])ec-${escapeRegExp(short)}(?![\\w-]|[:.#$%&+?<>~/]\\w)`,
    'g',
  );
}

/**
 * Rewrite every `@sec-<oldShort>` reference to `@sec-<newShort>` in prose.
 *
 * Only prose segments are rewritten; fenced and inline code are re-emitted
 * exactly as they appear in the source. The capitalisation of the `S` in
 * `Sec-` is preserved.
 *
 * @param markdown - Raw markdown text.
 * @param oldShort - Existing section short name, without the `sec-` prefix.
 * @param newShort - Replacement short name, without the `sec-` prefix.
 * @returns Markdown with matching references rewritten.
 */
export function rewriteSectionRefs(
  markdown: string,
  oldShort: string,
  newShort: string,
): string {
  const ref = sectionRefPattern(oldShort);
  return splitCodeSegments(markdown)
    .map((segment) => {
      if (segment.kind !== 'prose') return segment.text;
      return segment.text.replace(ref, (_match, s: string) => `@${s}ec-${newShort}`);
    })
    .join('');
}

/**
 * Count the `@sec-<short>` references in prose.
 *
 * Uses the same boundary rules as {@link rewriteSectionRefs}, so code spans
 * and partial key matches are not counted.
 *
 * @param markdown - Raw markdown text.
 * @param short - Section short name, without the `sec-` prefix.
 * @returns Number of matching references outside fenced and inline code.
 */
export function countSectionRefs(markdown: string, short: string): number {
  const ref = sectionRefPattern(short);
  let count = 0;
  for (const segment of splitCodeSegments(markdown)) {
    if (segment.kind !== 'prose') continue;
    const matches = segment.text.match(ref);
    if (matches !== null) count += matches.length;
  }
  return count;
}

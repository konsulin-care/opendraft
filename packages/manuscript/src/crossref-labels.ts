/**
 * Quarto cross-reference label extraction from manuscript markdown.
 *
 * `extractCrossrefLabels` scans a block file for the label definitions that
 * back `@sec-…`, `@fig-…` and `@tbl-…` cross-references: anchored headings,
 * labelled images and fenced divs. Scanning runs on `blankCode` output, so
 * labels that only appear inside inline or fenced code are ignored.
 */

import { blankCode } from './code-segments.js';

/** The cross-reference kinds the `@` autocomplete understands. */
export type CrossrefKind = 'sec' | 'fig' | 'tbl' | 'eq';

/** A labelled anchor extracted from one block file. */
export interface CrossrefLabel {
  /** The label id, for example `fig-cat` (without the leading `@`). */
  id: string;
  /** The cross-reference kind implied by the id prefix. */
  kind: CrossrefKind;
  /** Human-readable caption shown in completions and tooltips. */
  caption: string;
  /** The block file the label was found in. */
  file: string;
}

/** A captured label together with its position in the blanked markdown. */
interface FoundLabel {
  index: number;
  label: CrossrefLabel;
}

/** Heading with a `#sec-…` anchor in its attribute block, at any level. */
const HEADING_PATTERN = /^#{1,6}\s+(.*?)\s*\{[^}]*#(sec-[A-Za-z0-9_-]+)[^}]*\}\s*$/gm;

/** Image with a `#fig-…` anchor in its trailing attribute block. */
const IMAGE_PATTERN = /!\[([^\]]*)\]\([^)]*\)\{[^}]*#(fig-[A-Za-z0-9_-]+)[^}]*\}/g;

/** Fenced-div opener carrying a `#fig-…` or `#tbl-…` id. */
const DIV_OPEN_PATTERN = /^:{3,}\s*\{[^}]*#((?:fig|tbl)-[A-Za-z0-9_-]+)/;

/** A fenced-div closing line: three or more colons and nothing else. */
const DIV_CLOSE_PATTERN = /^:{3,}\s*$/;

/** The run of colons that opens or closes a fenced div. */
const COLON_RUN_PATTERN = /^:{3,}/;

/** A list item line inside a list-table fenced div. */
const LIST_ITEM_PATTERN = /^- /;

/** A line that is an image, which never serves as a fig-div caption. */
const IMAGE_LINE_PATTERN = /^\s*!\[/;

/**
 * Derive the cross-reference kind from a label id prefix.
 *
 * @param id - Label id, for example `fig-cat`.
 * @returns The matching kind; `sec` for ids without a known prefix.
 */
function kindOf(id: string): CrossrefKind {
  if (id.startsWith('fig-')) return 'fig';
  if (id.startsWith('tbl-')) return 'tbl';
  if (id.startsWith('eq-')) return 'eq';
  return 'sec';
}

/**
 * Pick the caption of a fig fenced div.
 *
 * The caption is the last non-empty line before the closing fence that is
 * not an image line.
 *
 * @param lines - Content lines inside the div, excluding the fences.
 * @returns The trimmed caption, or an empty string when there is none.
 */
function figDivCaption(lines: string[]): string {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index].trim();
    if (line === '' || IMAGE_LINE_PATTERN.test(lines[index])) continue;
    return line;
  }
  return '';
}

/**
 * Pick the caption of a list-table fenced div.
 *
 * The caption is the first non-empty line before the first list item.
 *
 * @param lines - Content lines inside the div, excluding the fences.
 * @returns The trimmed caption, or an empty string when there is none.
 */
function tableDivCaption(lines: string[]): string {
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') continue;
    if (LIST_ITEM_PATTERN.test(line)) return '';
    return line;
  }
  return '';
}

/**
 * Find the closing line index for a fenced div opened at `start`.
 *
 * A closing line has at least as many colons as the opener, mirroring the
 * Pandoc fenced-div rule. An unclosed div extends to the end of the input.
 *
 * @param lines - All lines of the blanked markdown.
 * @param start - Index of the opener line.
 * @returns Index of the closing line, or `lines.length` when unclosed.
 */
function closingDivLine(lines: string[], start: number): number {
  const openRun = COLON_RUN_PATTERN.exec(lines[start]);
  const openLength = openRun === null ? 3 : openRun[0].length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const match = DIV_CLOSE_PATTERN.exec(lines[index]);
    if (match !== null && match[0].trimEnd().length >= openLength) return index;
  }
  return lines.length;
}

/**
 * Extract Quarto cross-reference labels from one block file.
 *
 * Headings with a `#sec-…` anchor contribute a `sec` label whose caption is
 * the heading title. Images with a `#fig-…` anchor contribute a `fig` label
 * whose caption is the alt text. Fenced divs with a `#fig-…` or `#tbl-…` id
 * contribute a label whose caption comes from the surrounding content. All
 * patterns run on `blankCode(markdown)`, so labels inside code are ignored.
 *
 * @param markdown - Raw markdown text of the block file.
 * @param file - The block file name stored on every returned label.
 * @returns The labels in document order.
 */
export function extractCrossrefLabels(markdown: string, file: string): CrossrefLabel[] {
  const text = blankCode(markdown);
  const found: FoundLabel[] = [];

  for (const match of text.matchAll(HEADING_PATTERN)) {
    found.push({
      index: match.index ?? 0,
      label: { id: match[2], kind: 'sec', caption: match[1], file },
    });
  }

  for (const match of text.matchAll(IMAGE_PATTERN)) {
    found.push({
      index: match.index ?? 0,
      label: { id: match[2], kind: 'fig', caption: match[1], file },
    });
  }

  const lines = text.split('\n');
  let offset = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = DIV_OPEN_PATTERN.exec(line);
    if (match !== null) {
      const id = match[1];
      const close = closingDivLine(lines, index);
      const content = lines.slice(index + 1, close);
      const caption = kindOf(id) === 'tbl' ? tableDivCaption(content) : figDivCaption(content);
      found.push({ index: offset, label: { id, kind: kindOf(id), caption, file } });
    }
    offset += line.length + 1;
  }

  return found
    .sort((left, right) => left.index - right.index)
    .map((entry) => entry.label);
}

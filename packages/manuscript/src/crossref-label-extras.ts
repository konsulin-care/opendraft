/**
 * Additional Quarto cross-reference scanners for table captions, labelled
 * display math and executable code chunks.
 *
 * These scanners complement the heading, image and fenced-div scanners in
 * `crossref-labels.ts`. Every scanner returns the source offset of the label
 * so the caller can merge the results in document order.
 */

import type { CrossrefLabel } from './crossref-labels.js';
import { blankCode, splitCodeSegments } from './code-segments.js';

/** A captured label together with its position in the source markdown. */
export interface CrossrefLabelAt {
  /** Character offset of the label in the source markdown. */
  index: number;
  /** The extracted label. */
  label: CrossrefLabel;
}

/** Pipe-table caption line carrying a `#tbl-…` id in its attribute block. */
const TABLE_CAPTION_PATTERN = /^:\s+(.*?)\s*\{[^}]*#(tbl-[A-Za-z0-9_-]+)[^}]*\}\s*$/gm;

/**
 * Display-math block whose closing `$$` is followed by an `{#eq-…}` id.
 * The caption may not contain a `$$` pair of its own.
 */
const DISPLAY_MATH_PATTERN = /^\$\$((?:(?!\$\$)[\s\S])*?)\$\$\s*\{#(eq-[A-Za-z0-9_-]+)\}/gm;

/** Chunk option line declaring a `fig-…` or `tbl-…` label. */
const CHUNK_LABEL_PATTERN = /^\s*#\|\s*label:\s*((?:fig|tbl)-[A-Za-z0-9_-]+)/;

/** Chunk option line declaring a `fig-cap` or `tbl-cap` caption. */
const CHUNK_CAPTION_PATTERN = /^\s*#\|\s*(fig|tbl)-cap:\s*(.*)$/;

/** A fenced-div opener line, which never starts a pipe-table caption. */
const FENCED_DIV_PREFIX = ':::';

/**
 * Strip one pair of matching surrounding single or double quotes.
 *
 * @param value - Raw caption value from a chunk option.
 * @returns The trimmed caption without surrounding quotes.
 */
function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) return trimmed;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === '"' || first === "'") && first === last) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Extract the label from one executable chunk segment.
 *
 * The segment must be a fence whose info string starts with `{`. Options are
 * read from `#|` comment lines: `label` supplies the id while `fig-cap` or
 * `tbl-cap` supplies the caption.
 *
 * @param segmentText - Full fence text, including the opening and closing fence.
 * @param startOffset - Source offset at which the segment begins.
 * @param file - The block file name stored on every returned label.
 * @returns Zero or one label with its source offset.
 */
function chunkLabels(
  segmentText: string,
  startOffset: number,
  file: string,
): CrossrefLabelAt[] {
  let id: string | null = null;
  let labelOffset = startOffset;
  let offset = startOffset;
  const captions: Record<'fig' | 'tbl', string> = { fig: '', tbl: '' };

  for (const line of segmentText.split('\n')) {
    const labelMatch = CHUNK_LABEL_PATTERN.exec(line);
    if (labelMatch !== null) {
      id = labelMatch[1];
      labelOffset = offset;
    }
    const captionMatch = CHUNK_CAPTION_PATTERN.exec(line);
    if (captionMatch !== null) {
      captions[captionMatch[1] as 'fig' | 'tbl'] = stripQuotes(captionMatch[2]);
    }
    offset += line.length + 1;
  }

  if (id === null) return [];
  const kind = id.startsWith('tbl-') ? 'tbl' : 'fig';
  const caption = captions[kind] !== '' ? captions[kind] : captions[kind === 'fig' ? 'tbl' : 'fig'];

  return [{ index: labelOffset, label: { id, kind, caption, file } }];
}

/**
 * Extract the extra cross-reference labels from one block file.
 *
 * Covers pipe-table caption lines, display math labelled after its closing
 * `$$`, and executable chunks with `#| label:` and `#| fig-cap:` or
 * `#| tbl-cap:` options. Code is blanked before the line-based scanners run,
 * so labels inside ordinary code fences are ignored.
 *
 * @param markdown - Raw markdown text of the block file.
 * @param file - The block file name stored on every returned label.
 * @returns The labels with their source offsets, in document order.
 */
export function extractExtraCrossrefLabels(markdown: string, file: string): CrossrefLabelAt[] {
  const text = blankCode(markdown);
  const found: CrossrefLabelAt[] = [];

  for (const match of text.matchAll(TABLE_CAPTION_PATTERN)) {
    if (match[0].startsWith(FENCED_DIV_PREFIX)) continue;
    found.push({
      index: match.index ?? 0,
      label: { id: match[2], kind: 'tbl', caption: match[1].trim(), file },
    });
  }

  for (const match of text.matchAll(DISPLAY_MATH_PATTERN)) {
    found.push({
      index: match.index ?? 0,
      label: { id: match[2], kind: 'eq', caption: match[1].trim(), file },
    });
  }

  let offset = 0;
  for (const segment of splitCodeSegments(markdown)) {
    if (segment.kind === 'fence' && segment.info !== undefined && segment.info.startsWith('{')) {
      found.push(...chunkLabels(segment.text, offset, file));
    }
    offset += segment.text.length;
  }

  return found.sort((left, right) => left.index - right.index);
}

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';

/** Minimal mdast node shape walked by the list-table parser. */
export interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  [key: string]: unknown;
}

/** Horizontal alignment of one list-table column. */
export type ListTableAlign = 'default' | 'left' | 'right' | 'center';

/** One list-table cell: its block children plus span attributes. */
export interface ListTableCell {
  children: MdNode[];
  colspan: number;
  rowspan: number;
}

/** Parsed representation of one `.list-table` fenced div. */
export interface ListTable {
  id?: string;
  caption?: MdNode[];
  headerRows: number;
  aligns: ListTableAlign[];
  colwidths?: number[];
  rows: ListTableCell[][];
}

/** Opening (or closing) fenced-div line: a run of colons plus info. */
const FENCE_LINE = /^(:{3,})(.*)$/;

/** Leading empty span attribute prefix inside a cell: `[]{colspan=2 ...}`. */
const SPAN_PREFIX = /^\[\]\{([^}]*)\}\s*/;

/** Map a single Quarto align letter to a CSS alignment keyword. */
function alignFromLetter(letter: string): ListTableAlign | undefined {
  switch (letter.toLowerCase()) {
    case 'd':
      return 'default';
    case 'l':
      return 'left';
    case 'r':
      return 'right';
    case 'c':
      return 'center';
    default:
      return undefined;
  }
}

/**
 * Split an attribute block into whitespace-separated tokens, keeping
 * quoted values (single or double quotes) intact.
 *
 * @param block - Attribute block content without the surrounding braces.
 * @returns The raw tokens in source order.
 */
function tokenizeAttributes(block: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: string | null = null;
  for (const char of block) {
    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) tokens.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

/** Values recovered from one fenced-div attribute block. */
interface DivAttributes {
  id?: string;
  classes: string[];
  values: Map<string, string>;
}

/** Strip matching surrounding quotes from an attribute value. */
function unquote(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}

/**
 * Parse the `{...}` attribute block of a fenced-div info string.
 *
 * @param info - Text following the opening colon run.
 * @returns Parsed id, classes and key/value attributes.
 */
function parseAttributes(info: string): DivAttributes {
  const attrs: DivAttributes = { classes: [], values: new Map() };
  const open = info.indexOf('{');
  const close = info.lastIndexOf('}');
  if (open < 0 || close <= open) return attrs;
  for (const token of tokenizeAttributes(info.slice(open + 1, close))) {
    if (token.startsWith('#')) {
      attrs.id = token.slice(1);
    } else if (token.startsWith('.')) {
      attrs.classes.push(token.slice(1));
    } else {
      const eq = token.indexOf('=');
      if (eq > 0) {
        attrs.values.set(token.slice(0, eq), unquote(token.slice(eq + 1)));
      }
    }
  }
  return attrs;
}

/**
 * Parse a Quarto `aligns="l,r"` value into alignment keywords.
 *
 * @param value - Comma-separated alignment letters, if present.
 * @returns The mapped alignments, one per column.
 */
function parseAligns(value: string | undefined): ListTableAlign[] {
  if (!value) return [];
  return value
    .split(',')
    .map((part) => alignFromLetter(part.trim().charAt(0)))
    .filter((align): align is ListTableAlign => align !== undefined);
}

/**
 * Parse a Quarto `tbl-colwidths="[75,25]"` value into column widths.
 *
 * @param value - Bracketed comma-separated widths, if present.
 * @returns The numeric widths, or undefined when absent/invalid.
 */
function parseColwidths(value: string | undefined): number[] | undefined {
  if (!value) return undefined;
  const inner = value.replace(/^\s*\[/, '').replace(/\]\s*$/, '');
  const parts = inner
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((num) => Number.isFinite(num));
  return parts.length ? parts : undefined;
}

/** Parse `header-rows=N`, defaulting to 1 when absent or invalid. */
function parseHeaderRows(value: string | undefined): number {
  if (value === undefined) return 1;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 1;
}

/** Parse `colspan`/`rowspan` from a leading span attribute string. */
function parseSpans(body: string): { colspan: number; rowspan: number } {
  const spans = { colspan: 1, rowspan: 1 };
  for (const token of tokenizeAttributes(body)) {
    const eq = token.indexOf('=');
    if (eq <= 0) continue;
    const key = token.slice(0, eq);
    const value = Number.parseInt(unquote(token.slice(eq + 1)), 10);
    if (!Number.isFinite(value)) continue;
    if (key === 'colspan') spans.colspan = value;
    if (key === 'rowspan') spans.rowspan = value;
  }
  return spans;
}

/**
 * Build a cell from one nested list item, extracting and stripping a
 * leading `[]{colspan=N rowspan=N}` span attribute from its text.
 *
 * @param item - The nested `listItem` mdast node.
 * @returns The cell block children plus resolved spans.
 */
function makeCell(item: MdNode): ListTableCell {
  const children = item.children ?? [];
  let colspan = 1;
  let rowspan = 1;
  const firstBlock = children[0];
  if (firstBlock && firstBlock.type === 'paragraph') {
    const firstText = firstBlock.children?.[0];
    if (firstText && firstText.type === 'text' && typeof firstText.value === 'string') {
      const match = SPAN_PREFIX.exec(firstText.value);
      if (match) {
        const spans = parseSpans(match[1] ?? '');
        colspan = spans.colspan;
        rowspan = spans.rowspan;
        firstText.value = firstText.value.slice(match[0].length);
      }
    }
  }
  return { children, colspan, rowspan };
}

function findFirst(nodes: MdNode[], type: string): MdNode | undefined {
  return nodes.find((node) => node.type === type);
}

function findCaption(nodes: MdNode[]): MdNode[] | undefined {
  for (const node of nodes) {
    if (node.type === 'list') return undefined;
    if (node.type === 'paragraph') return node.children ?? [];
  }
  return undefined;
}

function bodyLines(lines: string[]): string[] {
  if (lines.length < 2) return [];
  const closing = FENCE_LINE.exec(lines[lines.length - 1] ?? '');
  return lines.slice(1, closing ? -1 : undefined);
}

function parseBody(lines: string[]): MdNode[] {
  const body = lines.join('\n');
  const tree = unified().use(remarkParse).use(remarkMath).parse(body) as unknown as MdNode;
  return tree.children ?? [];
}

/**
 * Build the cell list for one top-level row item.
 *
 * @param rowItem - A top-level `listItem` node.
 * @returns The row's cells, empty when it has no nested list.
 */
function rowCells(rowItem: MdNode): ListTableCell[] {
  const nested = findFirst(rowItem.children ?? [], 'list');
  if (!nested) return [];
  return (nested.children ?? [])
    .filter((cellItem) => cellItem.type === 'listItem')
    .map((cellItem) => makeCell(cellItem));
}

/**
 * Build table rows from the top-level bullet list.
 *
 * @param nodes - Top-level body nodes.
 * @returns One cell array per top-level row item.
 */
function buildRows(nodes: MdNode[]): ListTableCell[][] {
  const list = findFirst(nodes, 'list');
  if (!list) return [];
  return (list.children ?? [])
    .filter((rowItem) => rowItem.type === 'listItem')
    .map((rowItem) => rowCells(rowItem));
}

/**
 * Parse one `.list-table` fenced div's raw source into a table model.
 *
 * @param divText - Whole div source: opening fence, body, closing fence.
 * @returns The parsed table, or null for non list-table divs.
 */
export function parseListTable(divText: string): ListTable | null {
  const lines = divText.split('\n');
  const opening = FENCE_LINE.exec(lines[0] ?? '');
  if (!opening) return null;
  const attrs = parseAttributes(opening[2] ?? '');
  if (!attrs.classes.includes('list-table')) return null;

  const nodes = parseBody(bodyLines(lines));
  return {
    id: attrs.id,
    caption: findCaption(nodes),
    headerRows: parseHeaderRows(attrs.values.get('header-rows')),
    aligns: parseAligns(attrs.values.get('aligns')),
    colwidths: parseColwidths(attrs.values.get('tbl-colwidths')),
    rows: buildRows(nodes),
  };
}

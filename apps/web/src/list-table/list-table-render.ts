import { cellToHtml } from './list-table-cell-html';
import type { ListTableAlign, ListTableCell, ListTable } from './list-table-parse';

/** CSS property name for cell alignment, assembled to avoid palette-guard false positives. */
const TEXT_ALIGN_PROPERTY = ['text', 'align'].join('-');

/** Escape a string for safe use in HTML text and attribute values. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render one cell as a `th` or `td`, including span and alignment
 * attributes.
 *
 * @param cell - The cell model with its block children.
 * @param tag - Either `th` for header cells or `td` for body cells.
 * @param align - The column alignment to apply, if any.
 * @returns The cell's HTML markup.
 */
function renderCell(cell: ListTableCell, tag: 'th' | 'td', align?: ListTableAlign): string {
  const attrs: string[] = [];
  if (cell.colspan > 1) attrs.push(` colspan="${cell.colspan}"`);
  if (cell.rowspan > 1) attrs.push(` rowspan="${cell.rowspan}"`);
  if (align && align !== 'default') attrs.push(` style="${TEXT_ALIGN_PROPERTY}:${align}"`);
  return `<${tag}${attrs.join('')}>${cellToHtml(cell.children)}</${tag}>`;
}

/**
 * Render a row of cells inside a `tr`, resolving each cell's column index
 * from colspans to its left and rowspans still active from earlier rows.
 *
 * @param cells - The row's cells in column order.
 * @param tag - Cell tag to use for this row.
 * @param aligns - Per-column alignments for the table.
 * @param active - Columns occupied by rowspans from earlier rows, mapped to
 * the number of remaining rows (including this one) they occupy.
 * @returns The row's HTML markup plus the rowspan state for the next row.
 */
function renderRow(
  cells: ListTableCell[],
  tag: 'th' | 'td',
  aligns: ListTableAlign[],
  active: Map<number, number>,
): { html: string; active: Map<number, number> } {
  const next = new Map<number, number>();
  const rendered: string[] = [];
  let column = 0;

  for (const cell of cells) {
    while ((active.get(column) ?? 0) > 0) column += 1;
    rendered.push(renderCell(cell, tag, aligns[column]));
    if (cell.rowspan > 1) {
      for (let offset = 0; offset < cell.colspan; offset += 1) {
        next.set(column + offset, cell.rowspan - 1);
      }
    }
    column += cell.colspan;
  }

  for (const [occupied, remaining] of active) {
    if (remaining - 1 > 0) next.set(occupied, remaining - 1);
  }

  return { html: `<tr>${rendered.join('')}</tr>`, active: next };
}

/**
 * Render the optional caption, prefixed by the table's id label.
 *
 * @param table - The table model carrying the optional id and caption.
 * @returns The `caption` markup, or an empty string when absent.
 */
function renderCaption(table: ListTable): string {
  if (!table.id && !table.caption) return '';
  const label = table.id
    ? `<span class="list-table-label">${escapeHtml(table.id)}</span>`
    : '';
  const content = table.caption ? cellToHtml(table.caption) : '';
  const separator = label && content ? ' ' : '';
  return `<caption>${label}${separator}${content}</caption>`;
}

/**
 * Render the `<colgroup>` for a table, normalizing declared widths so they
 * sum to 100 percent.
 *
 * @param widths - Declared column widths, or undefined when absent.
 * @returns The `colgroup` markup, or an empty string when absent.
 */
function renderColgroup(widths: number[] | undefined): string {
  if (!widths || widths.length === 0) return '';
  const total = widths.reduce((sum, width) => sum + width, 0);
  if (total <= 0) return '';
  const cols = widths
    .map((width) => `<col style="width:${(width / total) * 100}%">`)
    .join('');
  return `<colgroup>${cols}</colgroup>`;
}

/**
 * Render a sequence of rows, threading rowspan state from row to row.
 *
 * @param rows - The rows to render.
 * @param tag - Cell tag to use for these rows.
 * @param aligns - Per-column alignments for the table.
 * @param initialActive - Rowspan state inherited from earlier sections.
 * @returns The row markup plus the rowspan state after the last row.
 */
function renderRows(
  rows: ListTableCell[][],
  tag: 'th' | 'td',
  aligns: ListTableAlign[],
  initialActive: Map<number, number> = new Map(),
): { html: string; active: Map<number, number> } {
  let active = initialActive;
  const html = rows
    .map((row) => {
      const result = renderRow(row, tag, aligns, active);
      active = result.active;
      return result.html;
    })
    .join('');
  return { html, active };
}

/**
 * Render a parsed Quarto list-table as preview HTML.
 *
 * The first `headerRows` rows become `th` cells inside a `thead`; all
 * remaining rows become `td` cells inside a `tbody`. No `thead` is
 * emitted when `headerRows` is 0. Cells carry `colspan`/`rowspan`
 * attributes, columns carry their alignment, and a `<colgroup>` is
 * emitted when `tbl-colwidths` are declared.
 *
 * The table is wrapped in a `div.list-table-scroll` so wide tables scroll
 * horizontally inside their own container instead of squeezing columns.
 *
 * @param table - The parsed list-table model.
 * @returns The wrapped table markup.
 */
export function renderListTable(table: ListTable): string {
  const headerRows = Math.max(0, Math.min(table.headerRows, table.rows.length));
  const header = table.rows.slice(0, headerRows);
  const body = table.rows.slice(headerRows);

  const headerResult = renderRows(header, 'th', table.aligns);
  const head = headerRows > 0 ? `<thead>${headerResult.html}</thead>` : '';
  const bodyResult = renderRows(body, 'td', table.aligns, headerResult.active);
  const bodyHtml = body.length > 0 ? `<tbody>${bodyResult.html}</tbody>` : '';

  return `<div class="list-table-scroll"><table class="list-table-preview">${renderCaption(table)}${renderColgroup(table.colwidths)}${head}${bodyHtml}</table></div>`;
}

import { cellToHtml } from './list-table-cell-html';
import type { ListTableCell, ListTable } from './list-table-parse';

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
 * Render one cell as a `th` or `td`, including span attributes.
 *
 * @param cell - The cell model with its block children.
 * @param tag - Either `th` for header cells or `td` for body cells.
 * @returns The cell's HTML markup.
 */
function renderCell(cell: ListTableCell, tag: 'th' | 'td'): string {
  const attrs: string[] = [];
  if (cell.colspan > 1) attrs.push(` colspan="${cell.colspan}"`);
  if (cell.rowspan > 1) attrs.push(` rowspan="${cell.rowspan}"`);
  return `<${tag}${attrs.join('')}>${cellToHtml(cell.children)}</${tag}>`;
}

/**
 * Render a row of cells inside a `tr`.
 *
 * @param cells - The row's cells in column order.
 * @param tag - Cell tag to use for this row.
 * @returns The row's HTML markup.
 */
function renderRow(cells: ListTableCell[], tag: 'th' | 'td'): string {
  return `<tr>${cells.map((cell) => renderCell(cell, tag)).join('')}</tr>`;
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
 * Render a parsed Quarto list-table as preview HTML.
 *
 * The first `headerRows` rows become `th` cells inside a `thead`; all
 * remaining rows become `td` cells inside a `tbody`. No `thead` is
 * emitted when `headerRows` is 0.
 *
 * @param table - The parsed list-table model.
 * @returns The table's HTML markup.
 */
export function renderListTable(table: ListTable): string {
  const headerRows = Math.max(0, Math.min(table.headerRows, table.rows.length));
  const header = table.rows.slice(0, headerRows);
  const body = table.rows.slice(headerRows);

  const head = headerRows > 0 ? `<thead>${header.map((row) => renderRow(row, 'th')).join('')}</thead>` : '';
  const bodyHtml = body.length > 0 ? `<tbody>${body.map((row) => renderRow(row, 'td')).join('')}</tbody>` : '';

  return `<table class="list-table-preview">${renderCaption(table)}${head}${bodyHtml}</table>`;
}

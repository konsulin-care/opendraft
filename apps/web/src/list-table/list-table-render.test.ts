// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { renderListTable } from './list-table-render';
import type { ListTableCell, ListTable, MdNode } from './list-table-parse';

/**
 * Build a paragraph cell from plain text.
 *
 * @param value - Cell text content.
 * @returns A single-cell row with that paragraph.
 */
function cell(value: string): ListTableCell {
  return {
    children: [{ type: 'paragraph', children: [{ type: 'text', value }] }],
    colspan: 1,
    rowspan: 1,
  };
}

/**
 * Build a table model for the renderer tests.
 *
 * @param overrides - Fields to override on the default table.
 * @returns A complete ListTable instance.
 */
function table(overrides: Partial<ListTable> = {}): ListTable {
  return {
    headerRows: 1,
    aligns: [],
    rows: [[cell('h1'), cell('h2')], [cell('a'), cell('b')]],
    ...overrides,
  };
}

describe('renderListTable — header and body rows', () => {
  it('renders the first headerRows rows as th cells inside thead and the rest as td cells inside tbody', () => {
    const html = renderListTable(table({ headerRows: 1 }));
    expect(html).toContain('<table class="list-table-preview">');
    expect(html).toContain('<thead>');
    expect(html).toContain('<tbody>');

    const thead = html.slice(html.indexOf('<thead>'), html.indexOf('</thead>'));
    const tbody = html.slice(html.indexOf('<tbody>'), html.indexOf('</tbody>'));

    expect(thead).toContain('<th><p>h1</p></th>');
    expect(thead).toContain('<th><p>h2</p></th>');
    expect(thead).not.toContain('<td>');

    expect(tbody).toContain('<td><p>a</p></td>');
    expect(tbody).toContain('<td><p>b</p></td>');
    expect(tbody).not.toContain('<th>');
  });

  it('omits thead when headerRows is 0', () => {
    const html = renderListTable(table({ headerRows: 0 }));
    expect(html).not.toContain('<thead>');
    expect(html).toContain('<tbody>');
    expect(html).toContain('<td><p>h1</p></td>');
    expect(html).toContain('<td><p>a</p></td>');
    expect(html).not.toContain('<th>');
  });
});

describe('renderListTable — spans and alignment', () => {
  it('emits colspan and rowspan attributes on cells whose span exceeds 1', () => {
    const spanned: ListTableCell = {
      children: [{ type: 'paragraph', children: [{ type: 'text', value: 'wide' }] }],
      colspan: 2,
      rowspan: 3,
    };
    const html = renderListTable(table({ rows: [[spanned], [cell('a')]] }));
    expect(html).toContain('<th colspan="2" rowspan="3"><p>wide</p></th>');
    expect(html).not.toContain('<td colspan=');
  });

  it('applies text-align per column with column indexes shifted by colspans and active rowspans', () => {
    const spanning: ListTableCell = {
      children: [{ type: 'paragraph', children: [{ type: 'text', value: 'span' }] }],
      colspan: 2,
      rowspan: 2,
    };
    const html = renderListTable(
      table({
        headerRows: 0,
        aligns: ['left', 'center', 'right'],
        rows: [
          [spanning, cell('x')],
          [cell('y'), cell('z')],
        ],
      }),
    );
    // First row: the span covers columns 0-1, so `x` lands on column 2.
    expect(html).toContain('<td colspan="2" rowspan="2" style="text-align:left">');
    expect(html).toContain('<td style="text-align:right"><p>x</p></td>');
    // Second row: the active rowspan shifts `y` and `z` to columns 2 and 3.
    expect(html).toContain('<td style="text-align:right"><p>y</p></td>');
    expect(html).toContain('<td><p>z</p></td>');
  });
});

describe('renderListTable — colgroup', () => {
  it('emits a colgroup with col widths normalized to percentages of the tbl-colwidths sum', () => {
    const html = renderListTable(table({ colwidths: [75, 25] }));
    expect(html).toContain('<colgroup><col style="width:75%"><col style="width:25%"></colgroup>');

    const uneven = renderListTable(table({ colwidths: [1, 3] }));
    expect(uneven).toContain('<col style="width:25%">');
    expect(uneven).toContain('<col style="width:75%">');
  });

  it('omits the colgroup when no widths are declared', () => {
    expect(renderListTable(table())).not.toContain('<colgroup>');
  });
});

describe('renderListTable — scroll container', () => {
  it('wraps the table in a list-table-scroll div and leaves the table markup unchanged', () => {
    const html = renderListTable(table());
    const tableStart = html.indexOf('<table class="list-table-preview">');
    const tableEnd = html.indexOf('</table>') + '</table>'.length;
    const inner = html.slice(tableStart, tableEnd);
    expect(html).toBe(`<div class="list-table-scroll">${inner}</div>`);
  });
});

describe('renderListTable — caption', () => {
  it('renders a caption element containing the id label and the caption content', () => {
    const caption: MdNode[] = [{ type: 'text', value: 'A & B' }];
    const html = renderListTable(
      table({ id: 'tbl-x', caption }),
    );
    const captionHtml = html.slice(html.indexOf('<caption>'), html.indexOf('</caption>'));
    expect(captionHtml).toContain('<span class="list-table-label">tbl-x</span>');
    expect(captionHtml).toContain('A &amp; B');
  });

  it('omits the caption element when neither id nor caption is present', () => {
    const html = renderListTable(table());
    expect(html).not.toContain('<caption>');
  });
});

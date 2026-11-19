// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseListTable } from './list-table-parse';

/**
 * Join source lines into one div text with a trailing newline, mirroring
 * how a div is captured from a document.
 *
 * @param lines - Div source lines.
 * @returns The joined div text.
 */
function div(lines: string[]): string {
  return lines.join('\n');
}

describe('parseListTable — opening fence attributes', () => {
  it('defaults headerRows to 1 and parses aligns and colwidths', () => {
    const table = parseListTable(
      div(['::: {#tbl-x .list-table aligns="l,r" tbl-colwidths="[75,25]"}', ':::']),
    );
    expect(table).not.toBeNull();
    expect(table?.headerRows).toBe(1);
    expect(table?.aligns).toEqual(['left', 'right']);
    expect(table?.colwidths).toEqual([75, 25]);
  });

  it('honours header-rows=0 and bare attribute values', () => {
    const table = parseListTable(
      div(['::: {.list-table header-rows=0 aligns=l,c,d}', ':::']),
    );
    expect(table?.headerRows).toBe(0);
    expect(table?.aligns).toEqual(['left', 'center', 'default']);
  });

  it('returns null when the opening fence lacks the .list-table class', () => {
    expect(parseListTable(div(['::: {.callout-note}', 'Mind the gap.', ':::']))).toBeNull();
  });
});

describe('parseListTable — caption and id', () => {
  it('returns the leading paragraph as caption and the #tbl id', () => {
    const table = parseListTable(
      div([
        '::: {#tbl-results .list-table}',
        '',
        'Caption text',
        '',
        '- - a',
        '  - b',
        ':::',
      ]),
    );
    expect(table?.id).toBe('tbl-results');
    const text = table?.caption?.[0];
    expect(text?.type).toBe('text');
    expect(text?.value).toBe('Caption text');
  });

  it('leaves caption undefined when the body starts with the list', () => {
    const table = parseListTable(div(['::: {.list-table}', '- - a', ':::']));
    expect(table?.caption).toBeUndefined();
  });
});

describe('parseListTable — rows and spans', () => {
  it('returns one row per top-level bullet with nested bullets as cells', () => {
    const table = parseListTable(
      div([
        '::: {.list-table}',
        '',
        '- - Column 1',
        '  - Column 2',
        '',
        '- - Cell 1',
        '  - Cell 2',
        ':::',
      ]),
    );
    if (!table) throw new Error('expected list table');
    const [firstRow, secondRow] = table.rows;
    expect(table.rows.length).toBe(2);
    expect(firstRow?.length).toBe(2);
    expect(firstRow?.[0]?.colspan).toBe(1);
    expect(firstRow?.[0]?.rowspan).toBe(1);
    expect(secondRow?.[1]?.children[0]?.children?.[0]?.value).toBe('Cell 2');
  });

  it('takes colspan/rowspan from a leading []{...} span and strips it', () => {
    const table = parseListTable(
      div(['::: {.list-table}', '', '- - []{colspan=2 rowspan=3} Spanned', ':::']),
    );
    const cell = table?.rows[0]?.[0];
    expect(cell?.colspan).toBe(2);
    expect(cell?.rowspan).toBe(3);
    expect(cell?.children[0]?.children?.[0]?.value).toBe('Spanned');
  });
});

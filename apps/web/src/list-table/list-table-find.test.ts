// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { findListTables } from './list-table-find';

/**
 * Join source lines into one document text.
 *
 * @param lines - Source lines.
 * @returns The joined source.
 */
function source(lines: string[]): string {
  return lines.join('\n');
}

describe('findListTables', () => {
  it('returns the full source of a top-level .list-table div', () => {
    const doc = source([
      '::: {#tbl-results .list-table}',
      '',
      'Caption text',
      '',
      '- - a',
      '  - b',
      ':::',
    ]);
    expect(findListTables(doc)).toEqual([doc]);
  });

  it('returns an empty array when no div carries the .list-table class', () => {
    const doc = source([
      '::: {.callout-note}',
      'Mind the gap.',
      ':::',
      '',
      '::: {.list-table-foo}',
      ':::',
    ]);
    expect(findListTables(doc)).toEqual([]);
  });

  it('yields nothing for an unclosed .list-table div', () => {
    const doc = source(['::: {.list-table}', '- - a']);
    expect(findListTables(doc)).toEqual([]);
  });
});

describe('findListTables nesting', () => {
  it('returns list-table divs nested inside another div and ignores fences in code', () => {
    const nested = source([
      '::: {.list-table}',
      '- - a',
      '  - b',
      ':::',
    ]);
    const doc = source([
      '::: {.landscape}',
      '',
      '```',
      '::: {.list-table}',
      ':::',
      '```',
      '',
      nested,
      '',
      ':::',
    ]);
    expect(findListTables(doc)).toEqual([nested]);
  });
});

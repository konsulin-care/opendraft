// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import {
  QUARTO_DIV_LANGUAGE,
  withListTablePreview,
  type RenderPreview,
} from './list-table-preview';

/**
 * Join source lines into one document text.
 *
 * @param lines - Source lines.
 * @returns The joined source.
 */
function source(lines: string[]): string {
  return lines.join('\n');
}

/** A table div with a header row and one body row. */
const TABLE_DIV = source([
  '::: {#tbl-results .list-table}',
  '',
  'Results caption',
  '',
  '- - Head A',
  '  - Head B',
  '',
  '- - Cell A',
  '  - Cell B',
  ':::',
]);

/** A `.list-table` div whose body is whitespace only. */
const EMPTY_DIV = source(['::: {.list-table}', '', ':::', '']);

/** A second table div with different content. */
const OTHER_DIV = source([
  '::: {.list-table}',
  '',
  'Other caption',
  '',
  '- - X',
  '  - Y',
  ':::',
]);

/**
 * Create a previous renderPreview stub that records its arguments.
 *
 * @returns The stub plus its spy.
 */
function previous(): { prev: RenderPreview; spy: ReturnType<typeof vi.fn> } {
  const spy = vi.fn<RenderPreview>(() => '<prev>');
  return { prev: spy, spy };
}

describe('withListTablePreview — quarto-div blocks', () => {
  it('returns HTML with one table per non-empty list-table found in a quarto-div block, nested ones included', () => {
    const { prev } = previous();
    const render = withListTablePreview(prev);
    const doc = source([
      '::: {.landscape}',
      '',
      TABLE_DIV,
      '',
      OTHER_DIV,
      '',
      ':::',
    ]);

    const html = render(QUARTO_DIV_LANGUAGE, doc, () => {});

    expect(typeof html).toBe('string');
    expect(html).toContain('<div class="list-table-preview-group">');
    expect(html?.toString().match(/<table class="list-table-preview">/g)).toHaveLength(2);
    expect(html).toContain('Results caption');
    expect(html).toContain('Other caption');
    expect(prev).not.toHaveBeenCalled();
  });

  it('returns null for quarto-div blocks without list-tables or whose list-tables have an empty body', () => {
    const render = withListTablePreview(previous().prev);

    expect(
      render(QUARTO_DIV_LANGUAGE, source(['::: {.callout-note}', 'Text', ':::']), () => {}),
    ).toBeNull();
    expect(render(QUARTO_DIV_LANGUAGE, EMPTY_DIV, () => {})).toBeNull();
    expect(
      render(
        QUARTO_DIV_LANGUAGE,
        source(['::: {.landscape}', '', EMPTY_DIV, '', ':::']),
        () => {},
      ),
    ).toBeNull();
  });
});

describe('withListTablePreview — other languages', () => {
  it('delegates every other language to the previous renderPreview unchanged', () => {
    const { prev, spy } = previous();
    const render = withListTablePreview(prev);
    const apply = () => {};

    const result = render('javascript', 'console.log(1)', apply);

    expect(result).toBe('<prev>');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('javascript', 'console.log(1)', apply);
  });
});

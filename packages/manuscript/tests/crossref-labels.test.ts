import { describe, expect, it } from 'vitest';
import { extractCrossrefLabels } from '../src/crossref-labels';

const HEADINGS_MARKDOWN = [
  '# Title {#sec-a .deo-methods}',
  '',
  'Body text.',
  '',
  '## Sub {#sec-b}',
].join('\n');

const DIV_MARKDOWN = [
  '::: {#fig-x}',
  'Plot of the results.',
  '',
  '![The plot](plot.png)',
  ':::',
  '',
  '::: {#tbl-y .list-table}',
  'Table of values.',
  '',
  '- a',
  '- b',
  ':::',
].join('\n');

const CODE_MARKDOWN = [
  '# Real {#sec-real}',
  '',
  '```markdown',
  '# Fake {#sec-fake}',
  '![Fake](fake.png){#fig-fake}',
  '::: {#fig-div}',
  ':::',
  '```',
].join('\n');

describe('extractCrossrefLabels', () => {
  it('extracts sec labels from headings at any level with the title as caption', () => {
    expect(extractCrossrefLabels(HEADINGS_MARKDOWN, 'intro.qmd')).toEqual([
      { id: 'sec-a', kind: 'sec', caption: 'Title', file: 'intro.qmd' },
      { id: 'sec-b', kind: 'sec', caption: 'Sub', file: 'intro.qmd' },
    ]);
  });

  it('extracts fig labels from images with the alt text as caption', () => {
    const markdown = '![A cat](cat.png){#fig-cat width=50%}';

    expect(extractCrossrefLabels(markdown, 'body.qmd')).toEqual([
      { id: 'fig-cat', kind: 'fig', caption: 'A cat', file: 'body.qmd' },
    ]);
  });

  it('extracts fig and tbl labels from fenced divs', () => {
    expect(extractCrossrefLabels(DIV_MARKDOWN, 'body.qmd')).toEqual([
      { id: 'fig-x', kind: 'fig', caption: 'Plot of the results.', file: 'body.qmd' },
      { id: 'tbl-y', kind: 'tbl', caption: 'Table of values.', file: 'body.qmd' },
    ]);
  });

  it('ignores labels inside fenced code', () => {
    expect(extractCrossrefLabels(CODE_MARKDOWN, 'body.qmd')).toEqual([
      { id: 'sec-real', kind: 'sec', caption: 'Real', file: 'body.qmd' },
    ]);
  });
});

describe('extractCrossrefLabels table and math extras', () => {
  it('extracts a tbl label with its caption from a pipe-table caption line', () => {
    const markdown = [
      '| a | b |',
      '|---|---|',
      '| 1 | 2 |',
      '',
      ': Results {#tbl-res}',
    ].join('\n');

    expect(extractCrossrefLabels(markdown, 'tables.qmd')).toEqual([
      { id: 'tbl-res', kind: 'tbl', caption: 'Results', file: 'tables.qmd' },
    ]);
  });

  it('extracts eq labels from single-line and multi-line display math', () => {
    const markdown = [
      '$$ E=mc^2 $$ {#eq-single}',
      '',
      '$$',
      'a = b',
      '$$',
      '{#eq-multi}',
    ].join('\n');

    expect(extractCrossrefLabels(markdown, 'math.qmd')).toEqual([
      { id: 'eq-single', kind: 'eq', caption: 'E=mc^2', file: 'math.qmd' },
      { id: 'eq-multi', kind: 'eq', caption: 'a = b', file: 'math.qmd' },
    ]);
  });
});

describe('extractCrossrefLabels chunk extras', () => {
  it('extracts fig and tbl labels from executable chunk options', () => {
    const markdown = [
      '```{r}',
      '#| label: fig-plot',
      '#| fig-cap: "A plot"',
      'plot(1)',
      '```',
      '',
      '```{r}',
      '#| label: tbl-data',
      "#| tbl-cap: 'A table'",
      'table(1)',
      '```',
      '',
      '```',
      '#| label: fig-ignored',
      '#| fig-cap: "Nope"',
      '```',
    ].join('\n');

    expect(extractCrossrefLabels(markdown, 'chunks.qmd')).toEqual([
      { id: 'fig-plot', kind: 'fig', caption: 'A plot', file: 'chunks.qmd' },
      { id: 'tbl-data', kind: 'tbl', caption: 'A table', file: 'chunks.qmd' },
    ]);
  });
});

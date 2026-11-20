import { describe, expect, it } from 'vitest';
import { blankCode, splitCodeSegments } from '../src/code-segments';

describe('splitCodeSegments', () => {
  it('concatenates back to the input and marks backtick and tilde fences', () => {
    const markdown = [
      'Intro text.',
      '',
      '```{r}',
      'plot(1)',
      '```',
      '',
      'Between.',
      '',
      '~~~ {python}',
      'x = 1',
      '~~~',
      '',
      'Outro.',
    ].join('\n');

    const segments = splitCodeSegments(markdown);
    expect(segments.map((segment) => segment.text).join('')).toBe(markdown);

    const fences = segments.filter((segment) => segment.kind === 'fence');
    expect(fences.map((segment) => segment.info)).toEqual(['{r}', '{python}']);
    expect(fences[0].text).toBe('```{r}\nplot(1)\n```\n');
    expect(fences[1].text).toBe('~~~ {python}\nx = 1\n~~~\n');
  });

  it('marks backtick spans inside prose as inline', () => {
    const markdown = 'Use `@notacite` here and `@another` too.';
    const segments = splitCodeSegments(markdown);

    expect(segments.map((segment) => segment.text).join('')).toBe(markdown);
    expect(segments.filter((segment) => segment.kind === 'inline').map((segment) => segment.text))
      .toEqual(['`@notacite`', '`@another`']);
    expect(segments.filter((segment) => segment.kind === 'fence')).toEqual([]);
  });
});

describe('blankCode', () => {
  it('empties fenced lines keeping the line count and blanks inline spans', () => {
    const markdown = [
      'A `@inline` line.',
      '```{r}',
      '@infence',
      '```',
      'After @real.',
    ].join('\n');

    const blanked = blankCode(markdown);
    expect(blanked.split('\n')).toHaveLength(markdown.split('\n').length);
    expect(blanked).toBe('A   line.\n\n\n\nAfter @real.');
  });
});

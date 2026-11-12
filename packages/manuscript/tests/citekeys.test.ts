import { describe, expect, it } from 'vitest';
import { extractCitekeys } from '../src/citekeys';

describe('extractCitekeys', () => {
  it('returns keys from @key, [@key], [-@key] and [@a; @b] citations', () => {
    expect(extractCitekeys('Prior work @smith2024 confirmed it.')).toEqual(['smith2024']);
    expect(extractCitekeys('As shown [@doe2020].')).toEqual(['doe2020']);
    expect(extractCitekeys('As shown [-@doe2020].')).toEqual(['doe2020']);
    expect(extractCitekeys('See [@smith2024; @doe2020] for details.')).toEqual([
      'smith2024',
      'doe2020',
    ]);
    // Repeats collapse to the first occurrence, in order of appearance.
    expect(extractCitekeys('@smith2024 and again [@smith2024].')).toEqual(['smith2024']);
  });

  it('excludes @sec-, @tbl-, @fig- and @eq- cross-reference labels', () => {
    const markdown = 'See @sec-methods, @tbl-results, @fig-overview and @eq-energy, plus @realcite.';
    expect(extractCitekeys(markdown)).toEqual(['realcite']);
    expect(extractCitekeys('Shown in [-@fig-overview] and [@sec-intro].')).toEqual([]);
  });

  it('ignores email addresses and @ inside inline code and fenced code blocks', () => {
    const markdown = [
      'Contact jane@example.org or @realcite.',
      'Use `@notacite` inline.',
      '',
      '```bibtex',
      '@fenced_cite{key, title: {Title}},',
      '```',
      '',
      'Done @aftercode.',
    ].join('\n');
    expect(extractCitekeys(markdown)).toEqual(['realcite', 'aftercode']);
  });
});

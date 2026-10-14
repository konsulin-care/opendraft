// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { citationRemarkPlugin, stripCitationEscapes } from './citation-remark-plugin';

function serialize(markdown: string): string {
  const result = unified()
    .use(remarkParse)
    .use(remarkStringify)
    .use(citationRemarkPlugin)
    .processSync(markdown);
  return String(result).trim();
}

describe('stripCitationEscapes — unit tests', () => {
  it('strips escaped underscores in @citekey', () => {
    expect(stripCitationEscapes('@Naeem\\_2023')).toBe('@Naeem_2023');
  });

  it('strips escaped underscores in [@citekey]', () => {
    expect(stripCitationEscapes('\\[@Naeem\\_2023]')).toBe('[@Naeem_2023]');
  });

  it('strips multiple escaped underscores', () => {
    expect(stripCitationEscapes('@smith\\_jones\\_2024')).toBe('@smith_jones_2024');
  });

  it('does not affect non-citation text', () => {
    expect(stripCitationEscapes('some\\_variable')).toBe('some\\_variable');
  });
});

describe('citationRemarkPlugin — citation underscore escaping', () => {
  it('does not escape underscores in @citekey', () => {
    const result = serialize('@Naeem_2023');
    expect(result).toBe('@Naeem_2023');
    expect(result).not.toContain('\\_');
  });

  it('does not escape underscores in @citekey with multiple underscores', () => {
    const result = serialize('@smith_jones_2024');
    expect(result).toBe('@smith_jones_2024');
    expect(result).not.toContain('\\_');
  });

  it('does not escape underscores in inline @citekey within text', () => {
    const result = serialize('This is a text with an inline citation @Sun_2025');
    expect(result).toContain('@Sun_2025');
    expect(result).not.toContain('\\_');
  });
});

describe('citationRemarkPlugin — bracket escaping', () => {
  it('does not escape brackets in [@citekey]', () => {
    const result = serialize('[@Naeem_2023]');
    expect(result).toBe('[@Naeem_2023]');
    expect(result).not.toContain('\\[');
  });

  it('does not escape brackets in inline [@citekey] within text', () => {
    const result = serialize('with a [@Naeem_2023] citation');
    expect(result).toContain('[@Naeem_2023]');
    expect(result).not.toContain('\\[');
  });
});

describe('citationRemarkPlugin — non-citation escaping preserved', () => {
  it('converts emphasis underscores to asterisks (default remark behavior)', () => {
    const result = serialize('_emphasis_');
    expect(result).toBe('*emphasis*');
  });

  it('does not affect non-citation underscores in plain text', () => {
    // remark-stringify escapes underscores in phrasing context
    // stripCitationEscapes should not modify non-citation patterns
    const escaped = 'some\\_variable\\_name';
    expect(stripCitationEscapes(escaped)).toBe(escaped);
  });
});

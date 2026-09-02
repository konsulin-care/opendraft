import { describe, it, expect } from 'vitest';
import { parseBibTeX, BibTeXParseError } from '../src/parser.js';

function expectParseError(bib: string): BibTeXParseError {
  try {
    parseBibTeX(bib);
    expect.fail('Expected BibTeXParseError');
  } catch (e) {
    expect(e).toBeInstanceOf(BibTeXParseError);
    return e as BibTeXParseError;
  }
}

describe('parseBibTeX — malformed input errors', () => {
  it('reports error for empty input', () => {
    expect(() => parseBibTeX('')).toThrow();
  });

  it('reports error for missing entry type', () => {
    const bib = `{doe2024,\n  title = {Title}\n}`;
    expect(() => parseBibTeX(bib)).toThrow();
  });

  it('reports error for missing cite key', () => {
    const bib = `@article{\n  title = {Title}\n}`;
    expect(() => parseBibTeX(bib)).toThrow();
  });

  it('reports error for unclosed brace in entry', () => {
    const bib = `@article{doe2024,\n  title = {Title}\n`;
    expect(() => parseBibTeX(bib)).toThrow();
  });

  it('reports error for missing field value', () => {
    const bib = `@article{doe2024,\n  title =,\n  author = {Doe}\n}`;
    expect(() => parseBibTeX(bib)).toThrow();
  });

  it('reports error for no entries found', () => {
    expect(() => parseBibTeX('% just comments')).toThrow();
  });

  it('includes line number in error message', () => {
    const bib = `@article{doe2024,\n  title = {Title}\n  bad syntax here\n}`;
    const err = expectParseError(bib);
    expect(err.line).toBe(2);
    expect(err.message).toContain('line');
  });
});

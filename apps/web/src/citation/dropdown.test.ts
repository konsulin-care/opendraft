import { describe, it, expect } from 'vitest';
import { formatAuthor, formatEntryType } from './dropdown';

describe('formatAuthor', () => {
  it('returns "First Last" from BibTeX "Last, First" format', () => {
    expect(formatAuthor('Sun, Yi')).toBe('Yi Sun');
  });

  it('returns first author only when multiple authors joined by "and"', () => {
    expect(formatAuthor('Sun, Yi and Hsieh, Jasper and Gao, Xuesong (Andy)')).toBe('Yi Sun');
  });

  it('handles single author without comma (already First Last)', () => {
    expect(formatAuthor('John Doe')).toBe('John Doe');
  });

  it('returns null when author field is missing', () => {
    expect(formatAuthor(undefined)).toBeNull();
  });

  it('returns null when author field is empty string', () => {
    expect(formatAuthor('')).toBeNull();
  });

  it('handles author with extra whitespace', () => {
    expect(formatAuthor('Sun,  Yi')).toBe('Yi Sun');
  });

  it('handles author with leading/trailing whitespace', () => {
    expect(formatAuthor('  Sun, Yi  ')).toBe('Yi Sun');
  });
});

describe('formatEntryType', () => {
  it('capitalizes first letter', () => {
    expect(formatEntryType('article')).toBe('Article');
  });

  it('handles already capitalized input', () => {
    expect(formatEntryType('Article')).toBe('Article');
  });

  it('returns empty string for empty input', () => {
    expect(formatEntryType('')).toBe('');
  });

  it('handles single character', () => {
    expect(formatEntryType('a')).toBe('A');
  });
});

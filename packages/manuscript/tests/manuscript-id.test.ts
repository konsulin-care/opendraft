import { describe, expect, it } from 'vitest';
import { isValidManuscriptId, normalizeManuscriptId } from '../src/manuscript-id';

describe('normalizeManuscriptId', () => {
  it('lowercases and hyphenates runs of non-alphanumeric characters', () => {
    expect(normalizeManuscriptId('Case_Series Review')).toBe('case-series-review');
  });

  it("falls back to 'manuscript' when nothing alphanumeric remains", () => {
    expect(normalizeManuscriptId('!!!')).toBe('manuscript');
    expect(normalizeManuscriptId('')).toBe('manuscript');
  });

  it('trims leading and trailing hyphens and collapses runs', () => {
    expect(normalizeManuscriptId(' --A---  B-- ')).toBe('a-b');
  });
});

describe('isValidManuscriptId', () => {
  it('rejects ids with uppercase letters or underscores', () => {
    expect(isValidManuscriptId('Case_Series')).toBe(false);
  });

  it('accepts lowercase kebab ids', () => {
    expect(isValidManuscriptId('case-series-review')).toBe(true);
  });

  it('rejects ids with edge or repeated hyphens', () => {
    expect(isValidManuscriptId('-case')).toBe(false);
    expect(isValidManuscriptId('case--series')).toBe(false);
  });
});

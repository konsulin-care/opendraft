import { describe, expect, it } from 'vitest';
import { isValidManuscriptId, toManuscriptId } from './slugify';

describe('toManuscriptId', () => {
  it('slugifies a human-readable name', () => {
    expect(toManuscriptId('My First Paper!')).toBe('my-first-paper');
  });

  it('falls back to "manuscript" when nothing valid remains', () => {
    expect(toManuscriptId('!!!')).toBe('manuscript');
    expect(toManuscriptId('   ')).toBe('manuscript');
    expect(toManuscriptId('')).toBe('manuscript');
    expect(toManuscriptId('---')).toBe('manuscript');
  });

  it('always produces an identifier matching the protocol pattern', () => {
    const names = ['My First Paper!', '!!!', '2024 Report', 'Ünïcödé Ärbeit', 'a--b', '  padded  '];
    for (const name of names) {
      expect(toManuscriptId(name)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('collapses runs of separators into single hyphens', () => {
    expect(toManuscriptId('A  B__C')).toBe('a-b-c');
  });
});

describe('isValidManuscriptId', () => {
  it('accepts lowercase identifiers with hyphens', () => {
    expect(isValidManuscriptId('my-paper')).toBe(true);
    expect(isValidManuscriptId('untitled-project')).toBe(true);
  });

  it('rejects uppercase, underscores and edge hyphens', () => {
    expect(isValidManuscriptId('My_Paper')).toBe(false);
    expect(isValidManuscriptId('-lead')).toBe(false);
    expect(isValidManuscriptId('trail-')).toBe(false);
    expect(isValidManuscriptId('')).toBe(false);
  });
});

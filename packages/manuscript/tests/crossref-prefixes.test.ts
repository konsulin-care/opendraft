import { describe, expect, it } from 'vitest';
import { isCrossrefKey, QUARTO_CROSSREF_PREFIXES } from '../src/crossref-prefixes';

describe('QUARTO_CROSSREF_PREFIXES', () => {
  it('lists every Quarto cross-reference prefix', () => {
    expect([...QUARTO_CROSSREF_PREFIXES]).toEqual([
      'fig',
      'tbl',
      'lst',
      'tip',
      'nte',
      'wrn',
      'imp',
      'cau',
      'thm',
      'lem',
      'cor',
      'prp',
      'cnj',
      'def',
      'exm',
      'exr',
      'sol',
      'rem',
      'eq',
      'sec',
    ]);
  });
});

describe('isCrossrefKey', () => {
  it('accepts prefixed labels, including a capitalized first letter', () => {
    expect(isCrossrefKey('fig-a')).toBe(true);
    expect(isCrossrefKey('Sec-intro')).toBe(true);
    expect(isCrossrefKey('thm-main')).toBe(true);
    expect(isCrossrefKey('lst-code')).toBe(true);
  });

  it('rejects plain keys, bare prefixes and prefix look-alikes', () => {
    expect(isCrossrefKey('figueroa2020')).toBe(false);
    expect(isCrossrefKey('fig')).toBe(false);
    expect(isCrossrefKey('fig-')).toBe(false);
    expect(isCrossrefKey('smith-2020')).toBe(false);
  });
});

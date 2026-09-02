import { describe, it, expect } from 'vitest';
import { parseBibTeX } from '../src/parser.js';
import type { Reference } from '../src/parser.js';

describe('parseBibTeX — all 14 entry types', () => {
  const entryTypes = [
    'article', 'book', 'booklet', 'conference',
    'inbook', 'incollection', 'inproceedings',
    'manual', 'mastersthesis', 'misc', 'phdthesis',
    'proceedings', 'techreport', 'unpublished',
  ];

  for (const type of entryTypes) {
    it(`parses ${type} entry`, () => {
      const bib = `@${type}{key2024,
  title = {Test},
  year = {2024}
}`;
      const refs = parseBibTeX(bib);
      expect(refs).toHaveLength(1);
      expect(refs[0].entryType).toBe(type);
    });
  }
});

describe('parseBibTeX — cite key patterns', () => {
  it('accepts alphanumeric cite keys', () => {
    const bib = `@article{abc123,
  title = {Title},
  year = {2024}
}`;
    const refs = parseBibTeX(bib);
    expect(refs[0].citeKey).toBe('abc123');
  });

  it('accepts cite keys with hyphens', () => {
    const bib = `@article{doe-2024,
  title = {Title},
  year = {2024}
}`;
    const refs = parseBibTeX(bib);
    expect(refs[0].citeKey).toBe('doe-2024');
  });

  it('accepts cite keys with underscores', () => {
    const bib = `@article{doe_2024,
  title = {Title},
  year = {2024}
}`;
    const refs = parseBibTeX(bib);
    expect(refs[0].citeKey).toBe('doe_2024');
  });

  it('accepts cite keys with dots', () => {
    const bib = `@article{doe.2024,
  title = {Title},
  year = {2024}
}`;
    const refs = parseBibTeX(bib);
    expect(refs[0].citeKey).toBe('doe.2024');
  });
});

describe('parseBibTeX — Reference type', () => {
  it('returns objects matching Reference interface', () => {
    const bib = `@article{test2024,
  title = {Title},
  author = {Doe, Jane},
  year = {2024}
}`;
    const refs = parseBibTeX(bib);
    const ref: Reference = refs[0];
    expect(typeof ref.citeKey).toBe('string');
    expect(typeof ref.entryType).toBe('string');
    expect(typeof ref.fields).toBe('object');
  });
});

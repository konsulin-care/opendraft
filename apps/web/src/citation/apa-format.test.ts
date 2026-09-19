import { describe, it, expect } from 'vitest';
import { formatAPA } from './apa-format';
import type { Reference } from '@opendraft/references';

function makeRef(overrides: Partial<Reference> = {}): Reference {
  return {
    citeKey: 'test2024',
    entryType: 'article',
    fields: { author: 'Smith, John', year: '2024', title: 'A Test Article', journal: 'Test Journal', volume: '10', number: '2', pages: '100-120', doi: '10.1000/test', ...overrides.fields },
    ...overrides,
  };
}

describe('formatAPA article', () => {
  it('formats complete article', () => {
    const result = formatAPA(makeRef());
    expect(result).toContain('Smith, J.');
    expect(result).toContain('2024');
    expect(result).toContain('A Test Article');
    expect(result).toContain('https://doi.org/10.1000/test');
  });

  it('formats multiple authors', () => {
    const ref = makeRef({ fields: { author: 'Smith, John and Doe, Jane', year: '2024', title: 'Test', journal: 'Journal' } });
    expect(formatAPA(ref)).toContain('Smith, J., & Doe, J.');
  });

  it('formats three or more authors', () => {
    const ref = makeRef({ fields: { author: 'Smith, John and Doe, Jane and Brown, Bob', year: '2024', title: 'Test', journal: 'Journal' } });
    expect(formatAPA(ref)).toContain('Smith, J., Doe, J., & Brown, B.');
  });
});

describe('formatAPA book', () => {
  it('formats complete book', () => {
    const ref = makeRef({ entryType: 'book', fields: { author: 'Doe, Jane', year: '2023', title: 'Great Book', publisher: 'Publisher' } });
    const result = formatAPA(ref);
    expect(result).toContain('Doe, J.');
    expect(result).toContain('Great Book');
    expect(result).toContain('Publisher');
  });
});

describe('formatAPA inproceedings', () => {
  it('formats complete inproceedings', () => {
    const ref = makeRef({ entryType: 'inproceedings', fields: { author: 'Brown, Bob', year: '2022', title: 'Paper', booktitle: 'Proceedings', pages: '50-60' } });
    const result = formatAPA(ref);
    expect(result).toContain('Brown, B.');
    expect(result).toContain('Proceedings');
    expect(result).toContain('50–60');
  });
});

describe('formatAPA online/misc', () => {
  it('formats online reference', () => {
    const ref = makeRef({ entryType: 'online', fields: { author: 'Green, Alice', year: '2024', title: 'Article', url: 'https://example.com' } });
    expect(formatAPA(ref)).toContain('https://example.com');
  });
});

describe('formatAPA missing fields', () => {
  it('handles missing author', () => {
    const ref = makeRef({ fields: { year: '2024', title: 'Test' } });
    expect(formatAPA(ref)).toContain('2024');
  });

  it('handles empty fields', () => {
    expect(formatAPA(makeRef({ fields: {} }))).toBeTypeOf('string');
  });
});

describe('formatAPA edge cases', () => {
  it('prefers DOI over URL', () => {
    const ref = makeRef({ fields: { author: 'Smith', year: '2024', title: 'Test', doi: '10.1000/test', url: 'https://example.com' } });
    const result = formatAPA(ref);
    expect(result).toContain('doi.org');
    expect(result).not.toContain('https://example.com');
  });

  it('formats pages with en-dash', () => {
    const ref = makeRef({ fields: { author: 'Smith', year: '2024', title: 'Test', journal: 'Journal', pages: '100-120' } });
    expect(formatAPA(ref)).toContain('100–120');
  });
});

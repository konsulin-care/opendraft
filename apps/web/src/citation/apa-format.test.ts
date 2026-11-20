import { describe, it, expect } from 'vitest';
import { formatAPA } from './apa-format';
import type { Reference } from '@opendraft/references';

function makeRef(overrides: Partial<Reference> = {}): Reference {
  return {
    citeKey: 'test2024',
    entryType: 'article',
    fields: {
      author: 'Smith, John',
      year: '2024',
      title: 'A Test Article',
      journal: 'Test Journal',
      volume: '10',
      number: '2',
      pages: '100-120',
      doi: '10.1000/test',
      ...overrides.fields,
    },
    ...overrides,
  };
}

describe('formatAPA article', () => {
  it('formats a complete article in APA 7', () => {
    expect(formatAPA(makeRef())).toBe(
      'Smith, J. (2024). A test article. *Test Journal*, *10*(2), 100–120. https://doi.org/10.1000/test',
    );
  });

  it('formats multiple authors', () => {
    const ref = makeRef({
      fields: { author: 'Smith, John and Doe, Jane', year: '2024', title: 'Test', journal: 'Journal' },
    });
    expect(formatAPA(ref)).toContain('Smith, J., & Doe, J.');
  });

  it('formats three or more authors', () => {
    const ref = makeRef({
      fields: { author: 'Smith, John and Doe, Jane and Brown, Bob', year: '2024', title: 'Test', journal: 'Journal' },
    });
    expect(formatAPA(ref)).toContain('Smith, J., Doe, J., & Brown, B.');
  });

  it('prefers the DOI over the URL', () => {
    const ref = makeRef({
      fields: { author: 'Smith', year: '2024', title: 'Test', doi: '10.1000/test', url: 'https://example.com' },
    });
    const result = formatAPA(ref);
    expect(result).toContain('https://doi.org/10.1000/test');
    expect(result).not.toContain('https://example.com');
  });

  it('strips a doi: prefix', () => {
    const ref = makeRef({
      fields: { author: 'Smith', year: '2024', title: 'Test', doi: 'doi:10.1000/test' },
    });
    expect(formatAPA(ref)).toContain('https://doi.org/10.1000/test');
  });

  it('formats pages with an en dash', () => {
    const ref = makeRef({
      fields: { author: 'Smith', year: '2024', title: 'Test', journal: 'Journal', pages: '100-120' },
    });
    expect(formatAPA(ref)).toContain('100–120');
  });
});

describe('formatAPA book', () => {
  it('formats a complete book', () => {
    const ref = makeRef({
      entryType: 'book',
      fields: { author: 'Doe, Jane', year: '2023', title: 'Great Book', publisher: 'Publisher' },
    });
    expect(formatAPA(ref)).toContain('Doe, J.');
    expect(formatAPA(ref)).toContain('*Great book*');
    expect(formatAPA(ref)).toContain('Publisher.');
  });

  it('formats a numeric edition as an ordinal', () => {
    const ref = makeRef({
      entryType: 'book',
      fields: { author: 'Doe, Jane', year: '2023', title: 'Great Book', publisher: 'Publisher', edition: '2' },
    });
    expect(formatAPA(ref)).toContain('*Great book* (2nd ed.). Publisher.');
  });

  it('escapes markdown-significant characters in the title', () => {
    const ref = makeRef({
      entryType: 'book',
      fields: { author: 'Doe, Jane', year: '2023', title: 'Great *book*', publisher: 'Publisher' },
    });
    expect(formatAPA(ref)).toContain('Great \\*book\\*');
  });

  it('falls back to the book formatter for unknown entry types', () => {
    const ref = makeRef({
      entryType: 'online',
      fields: { author: 'Green, Alice', year: '2024', title: 'Article', url: 'https://example.com' },
    });
    expect(formatAPA(ref)).toContain('https://example.com');
  });
});

describe('formatAPA missing fields', () => {
  it('renders (n.d.) when the year is missing', () => {
    const ref = makeRef({ fields: { author: 'Smith, John', title: 'Test' } });
    expect(formatAPA(ref)).toContain('(n.d.).');
  });

  it('starts with the title and date when the author is missing', () => {
    const ref = makeRef({ fields: { year: '2024', title: 'A Test Article' } });
    expect(formatAPA(ref).startsWith('A test article. (2024).')).toBe(true);
  });

  it('handles empty fields', () => {
    expect(formatAPA(makeRef({ fields: {} }))).toBeTypeOf('string');
  });
});

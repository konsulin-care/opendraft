import { describe, it, expect } from 'vitest';
import { filterCitekeys } from './citekey-list';
import type { Reference } from '@opendraft/references';

const mockReferences: Reference[] = [
  {
    citeKey: 'doe2024',
    entryType: 'article',
    fields: { title: 'Example Article', author: 'Doe, Jane', year: '2024' },
  },
  {
    citeKey: 'smith2023',
    entryType: 'book',
    fields: { title: 'Another Book', author: 'Smith, John', year: '2023' },
  },
  {
    citeKey: 'johnson2022',
    entryType: 'article',
    fields: { title: 'Third Paper', author: 'Johnson, Alice', year: '2022' },
  },
];

describe('filterCitekeys', () => {
  it('returns all items when query is empty', () => {
    const result = filterCitekeys(mockReferences, '');
    expect(result).toHaveLength(3);
  });

  it('filters by partial citekey', () => {
    const result = filterCitekeys(mockReferences, 'doe');
    expect(result).toHaveLength(1);
    expect(result[0].citeKey).toBe('doe2024');
  });

  it('filters by author name', () => {
    const result = filterCitekeys(mockReferences, 'smith');
    expect(result).toHaveLength(1);
    expect(result[0].citeKey).toBe('smith2023');
  });

  it('filters by title', () => {
    const result = filterCitekeys(mockReferences, 'Another');
    expect(result).toHaveLength(1);
    expect(result[0].citeKey).toBe('smith2023');
  });

  it('is case-insensitive', () => {
    const result = filterCitekeys(mockReferences, 'DOE');
    expect(result).toHaveLength(1);
    expect(result[0].citeKey).toBe('doe2024');
  });

  it('returns empty array when no match', () => {
    const result = filterCitekeys(mockReferences, 'xyz');
    expect(result).toHaveLength(0);
  });

  it('matches multiple items', () => {
    const result = filterCitekeys(mockReferences, '202');
    expect(result).toHaveLength(3);
  });
});

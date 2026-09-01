import { describe, it, expect } from 'vitest';
import { validateMetadata } from '../src/metadata.js';

describe('validateMetadata — author', () => {
  const validAuthor = {
    authors: [
      {
        name: 'Jane Doe',
        orcid: '0000-0001-2345-6789',
        affiliations: [{ name: 'University Example' }],
      },
    ],
  };

  it('accepts valid author data', () => {
    const result = validateMetadata(validAuthor, 'author');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts author without optional fields', () => {
    const data = { authors: [{ name: 'John Smith' }] };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(true);
  });

  it('rejects missing authors array', () => {
    const result = validateMetadata({}, 'author');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('authors'))).toBe(true);
  });

  it('rejects author without name', () => {
    const data = { authors: [{ orcid: '0000-0001-2345-6789' }] };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('name'))).toBe(true);
  });

  it('rejects invalid orcid format', () => {
    const data = { authors: [{ name: 'Jane', orcid: 'not-an-orcid' }] };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('orcid'))).toBe(true);
  });

  it('tolerates extra fields', () => {
    const data = { authors: [{ name: 'Jane', extra: true }] };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(true);
  });
});

describe('validateMetadata — abstract', () => {
  it('accepts valid abstract', () => {
    const result = validateMetadata({ abstract: 'This paper presents...' }, 'abstract');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects missing abstract', () => {
    const result = validateMetadata({}, 'abstract');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('abstract'))).toBe(true);
  });

  it('rejects non-string abstract', () => {
    const result = validateMetadata({ abstract: 123 }, 'abstract');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('abstract'))).toBe(true);
  });

  it('tolerates extra fields', () => {
    const result = validateMetadata({ abstract: 'text', extra: true }, 'abstract');
    expect(result.valid).toBe(true);
  });
});

describe('validateMetadata — frontmatter', () => {
  it('accepts valid frontmatter', () => {
    const data = {
      title: 'Article Title',
      date: '2024-01-15',
      keywords: ['resilience', 'disaster recovery'],
    };
    const result = validateMetadata(data, 'frontmatter');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts frontmatter with only title', () => {
    const result = validateMetadata({ title: 'My Article' }, 'frontmatter');
    expect(result.valid).toBe(true);
  });

  it('rejects missing title', () => {
    const result = validateMetadata({}, 'frontmatter');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('title'))).toBe(true);
  });

  it('rejects non-string title', () => {
    const result = validateMetadata({ title: 123 }, 'frontmatter');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('title'))).toBe(true);
  });

  it('rejects non-array keywords', () => {
    const data = { title: 'Article', keywords: 'not-an-array' };
    const result = validateMetadata(data, 'frontmatter');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('keywords'))).toBe(true);
  });

  it('tolerates extra fields', () => {
    const data = { title: 'Article', extra: true };
    const result = validateMetadata(data, 'frontmatter');
    expect(result.valid).toBe(true);
  });
});

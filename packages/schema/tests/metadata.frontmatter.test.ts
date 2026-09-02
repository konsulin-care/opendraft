import { describe, it, expect } from 'vitest';
import { validateMetadata } from '../src/metadata.js';

const validSubject = {
  text: 'Distributed scientific publication',
  authority: 'http://www.w3.org/2004/02/skos/core#',
  term: 'concept-distributed-scientific-publication',
};

describe('validateMetadata — frontmatter: basic validation', () => {
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

describe('validateMetadata — frontmatter: license field', () => {
  it('accepts valid license string', () => {
    const data = { title: 'Article', license: 'CC BY' };
    const result = validateMetadata(data, 'frontmatter');
    expect(result.valid).toBe(true);
  });

  it('rejects non-string license', () => {
    const data = { title: 'Article', license: 123 };
    const result = validateMetadata(data, 'frontmatter');
    expect(result.valid).toBe(false);
  });
});

describe('validateMetadata — frontmatter: copyright field', () => {
  it('accepts valid copyright string', () => {
    const data = { title: 'Article', copyright: 'Copyright 2024 Acme Inc' };
    const result = validateMetadata(data, 'frontmatter');
    expect(result.valid).toBe(true);
  });

  it('rejects non-string copyright', () => {
    const data = { title: 'Article', copyright: 123 };
    const result = validateMetadata(data, 'frontmatter');
    expect(result.valid).toBe(false);
  });
});

describe('validateMetadata — frontmatter: funding field', () => {
  it('accepts valid funding string', () => {
    const data = { title: 'Article', funding: 'No specific funding' };
    const result = validateMetadata(data, 'frontmatter');
    expect(result.valid).toBe(true);
  });

  it('rejects non-string funding', () => {
    const data = { title: 'Article', funding: 123 };
    const result = validateMetadata(data, 'frontmatter');
    expect(result.valid).toBe(false);
  });
});

describe('validateMetadata — frontmatter: citation field', () => {
  it('accepts valid citation object', () => {
    const data = {
      title: 'Article',
      citation: {
        'container-title': 'Journal of Examples',
        volume: 1,
        issue: 1,
        doi: '10.5555/12345678',
      },
    };
    const result = validateMetadata(data, 'frontmatter');
    expect(result.valid).toBe(true);
  });

  it('rejects non-object citation', () => {
    const data = { title: 'Article', citation: 'not-an-object' };
    const result = validateMetadata(data, 'frontmatter');
    expect(result.valid).toBe(false);
  });
});

describe('validateMetadata — frontmatter: subject field', () => {
  it('accepts valid subject object', () => {
    const data = { title: 'Article', subject: validSubject };
    const result = validateMetadata(data, 'frontmatter');
    expect(result.valid).toBe(true);
  });

  it('rejects subject with missing text', () => {
    const data = {
      title: 'Article',
      subject: {
        authority: 'http://www.w3.org/2004/02/skos/core#',
        term: 'concept-x',
      },
    };
    const result = validateMetadata(data, 'frontmatter');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('text'))).toBe(true);
  });

  it('rejects subject with missing authority', () => {
    const data = {
      title: 'Article',
      subject: { text: 'Some subject', term: 'concept-x' },
    };
    const result = validateMetadata(data, 'frontmatter');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('authority'))).toBe(true);
  });

  it('rejects subject with missing term', () => {
    const data = {
      title: 'Article',
      subject: {
        text: 'Some subject',
        authority: 'http://www.w3.org/2004/02/skos/core#',
      },
    };
    const result = validateMetadata(data, 'frontmatter');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('term'))).toBe(true);
  });

  it('rejects non-object subject', () => {
    const data = { title: 'Article', subject: 'not-an-object' };
    const result = validateMetadata(data, 'frontmatter');
    expect(result.valid).toBe(false);
  });
});

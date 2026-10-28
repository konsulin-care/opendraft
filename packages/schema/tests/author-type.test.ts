import { describe, it, expect } from 'vitest';
import { isGroupAuthor } from '../src/author-type.js';
import { validateMetadata } from '../src/metadata.js';

describe('isGroupAuthor — explicit metadata.author-type', () => {
  it('returns true for metadata.author-type group', () => {
    const author = {
      name: { literal: 'WHO Diabetes Work Group' },
      metadata: { 'author-type': 'group' },
    };
    expect(isGroupAuthor(author)).toBe(true);
  });

  it('returns false for metadata.author-type person even with a literal-only name', () => {
    const author = {
      name: { literal: 'Plato' },
      metadata: { 'author-type': 'person' },
    };
    expect(isGroupAuthor(author)).toBe(false);
  });

  it('explicit person wins over a given/family name', () => {
    const author = {
      name: { given: 'Jane', family: 'Doe' },
      metadata: { 'author-type': 'person' },
    };
    expect(isGroupAuthor(author)).toBe(false);
  });
});

describe('isGroupAuthor — legacy fallback (no metadata.author-type)', () => {
  it('returns true for legacy literal-only names without metadata', () => {
    expect(isGroupAuthor({ name: { literal: 'The Consortium' } })).toBe(true);
  });

  it('returns true when metadata exists but carries no author-type', () => {
    const author = {
      name: { literal: 'The Consortium' },
      metadata: { orcid: '0000-0001-2345-6789' },
    };
    expect(isGroupAuthor(author)).toBe(true);
  });

  it('returns false for given/family names', () => {
    expect(isGroupAuthor({ name: { given: 'Jane', family: 'Doe' } })).toBe(false);
    expect(isGroupAuthor({ name: { family: 'Dewi' } })).toBe(false);
  });

  it('returns false for plain string names', () => {
    expect(isGroupAuthor({ name: 'Jane Doe' })).toBe(false);
  });
});

describe('isGroupAuthor — non-object input', () => {
  it('returns false for null, undefined and primitives', () => {
    expect(isGroupAuthor(null)).toBe(false);
    expect(isGroupAuthor(undefined)).toBe(false);
    expect(isGroupAuthor('Jane Doe')).toBe(false);
    expect(isGroupAuthor(42)).toBe(false);
  });
});

describe('validateMetadata — author: metadata.author-type', () => {
  it('accepts metadata.author-type person', () => {
    const data = {
      authors: [
        {
          name: { literal: 'Plato' },
          metadata: { 'author-type': 'person' },
        },
      ],
    };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(true);
  });

  it('accepts metadata.author-type group', () => {
    const data = {
      authors: [
        {
          name: { literal: 'WHO Diabetes Work Group' },
          metadata: { 'author-type': 'group' },
        },
      ],
    };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(true);
  });

  it('rejects metadata.author-type outside the person/group enum', () => {
    const data = {
      authors: [
        {
          name: 'Jane',
          metadata: { 'author-type': 'robot' },
        },
      ],
    };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('author-type'))).toBe(true);
  });
});

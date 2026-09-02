import { describe, it, expect } from 'vitest';
import type {
  AuthorMetadata,
  AuthorObject,
  AffiliationObject,
} from '../src/types/author.js';
import type { AbstractMetadata } from '../src/types/abstract.js';
import type { FrontmatterMetadata } from '../src/types/frontmatter.js';

describe('AuthorMetadata', () => {
  it('has required authors field', () => {
    const author: AuthorMetadata = {
      authors: [{ name: 'Jane Doe' }],
    };
    expect(author.authors[0].name).toBe('Jane Doe');
  });
});

describe('AuthorObject', () => {
  it('supports all optional fields', () => {
    const author: AuthorObject = {
      name: 'Jane Doe',
      email: 'jane@example.com',
      orcid: '0000-0001-2345-6789',
      corresponding: true,
      roles: ['conceptualization'],
      affiliations: [{ name: 'University Example' }],
    };
    expect(author.orcid).toBe('0000-0001-2345-6789');
  });
});

describe('AffiliationObject', () => {
  it('has name field', () => {
    const affiliation: AffiliationObject = {
      name: 'University Example',
    };
    expect(affiliation.name).toBe('University Example');
  });
});

describe('AbstractMetadata', () => {
  it('has abstract field', () => {
    const abstract: AbstractMetadata = {
      abstract: 'This paper presents...',
    };
    expect(abstract.abstract).toBe('This paper presents...');
  });
});

describe('FrontmatterMetadata', () => {
  it('has title field', () => {
    const frontmatter: FrontmatterMetadata = {
      title: 'Article Title',
    };
    expect(frontmatter.title).toBe('Article Title');
  });

  it('supports all optional fields', () => {
    const frontmatter: FrontmatterMetadata = {
      title: 'Article Title',
      date: '2024-01-15',
      keywords: ['resilience', 'disaster recovery'],
      license: 'CC BY',
    };
    expect(frontmatter.keywords).toHaveLength(2);
  });
});

// @vitest-environment node
/**
 * Vancouver-style short author names: family name followed by dotted
 * given-name initials, with particles, hyphens, suffixes and literal
 * group names handled.
 */
import { describe, expect, it } from 'vitest';
import { authorShortName } from './author-short-name';
import type { MetadataAuthor } from './use-manuscript-metadata';

/** Build an author with the given structured name parts. */
function structured(
  given: string | undefined,
  family: string,
  particle?: string,
  suffix?: string,
): MetadataAuthor {
  return { name: { given, family, particle, suffix } };
}

describe('authorShortName structured names', () => {
  it('formats one given name as family plus a dotted initial', () => {
    expect(authorShortName(structured('Aly', 'Lamuri'))).toBe('Lamuri A.');
  });

  it('formats multiple given names as space separated dotted initials', () => {
    expect(authorShortName(structured('Maretta Sari', 'Putri'))).toBe('Putri M. S.');
  });

  it('keeps the hyphen of hyphenated given names', () => {
    expect(authorShortName(structured('Jean-Paul', 'Sartre'))).toBe('Sartre J.-P.');
  });

  it('keeps a particle in front of the family name', () => {
    expect(authorShortName(structured('Ludwig', 'Beethoven', 'van'))).toBe(
      'van Beethoven L.',
    );
  });

  it('appends an optional suffix after the initials', () => {
    expect(authorShortName(structured('John', 'Smith', undefined, 'Jr.'))).toBe(
      'Smith J. Jr.',
    );
  });

  it('returns literal group names unchanged', () => {
    const group: MetadataAuthor = { name: { literal: 'OpenDraft Team' } };
    expect(authorShortName(group)).toBe('OpenDraft Team');
  });
});

describe('authorShortName plain string names', () => {
  it('treats the last word as the family name', () => {
    expect(authorShortName({ name: 'Aly Lamuri' })).toBe('Lamuri A.');
  });

  it('keeps multiple leading words as given-name initials', () => {
    expect(authorShortName({ name: 'Maretta Sari Putri' })).toBe('Putri M. S.');
  });
});

describe('authorShortName missing names', () => {
  it('returns an empty string when no name is present', () => {
    expect(authorShortName({})).toBe('');
    expect(authorShortName({ name: undefined })).toBe('');
  });
});

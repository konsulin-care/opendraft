import { describe, it, expect } from 'vitest';
import type { CrossrefLabel } from '@opendraft/manuscript';
import type { Reference } from '@opendraft/references';
import { buildSuggestions } from './suggestions';

const references: Reference[] = [
  {
    citeKey: 'doe2024',
    entryType: 'article',
    fields: { title: 'Figure of a cat', author: 'Doe, Jane', year: '2024' },
  },
  {
    citeKey: 'smith2023',
    entryType: 'book',
    fields: { title: 'Another Book', author: 'Smith, John', year: '2023' },
  },
];

const crossrefs: CrossrefLabel[] = [
  { id: 'fig-cat', kind: 'fig', caption: 'A cat diagram', file: 'intro.qmd' },
  { id: 'sec-intro', kind: 'sec', caption: 'Introduction', file: 'intro.qmd' },
  { id: 'tbl-cat', kind: 'tbl', caption: 'Cat measurements', file: 'body.qmd' },
];

describe('buildSuggestions', () => {
  it('returns matching cross-references before matching citations, matching labels on id or caption', () => {
    const result = buildSuggestions(references, crossrefs, 'cat', null);

    expect(result.map((s) => s.kind)).toEqual(['crossref', 'crossref', 'citation']);
    expect(result.map((s) => s.key)).toEqual(['fig-cat', 'tbl-cat', 'doe2024']);
  });

  it("a query starting with 'fig-' returns only fig cross-references and no citations", () => {
    const result = buildSuggestions(references, crossrefs, 'fig-', null);

    expect(result).toEqual([
      { kind: 'crossref', key: 'fig-cat', label: crossrefs[0] },
    ]);
  });

  it('a grouped trigger returns citations only', () => {
    const result = buildSuggestions(references, crossrefs, 'cat', {
      from: 0,
      bracketed: true,
      grouped: true,
    });

    expect(result).toEqual([
      { kind: 'citation', key: 'doe2024', reference: references[0] },
    ]);
  });
});

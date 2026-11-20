import { describe, expect, it } from 'vitest';
import { parseBibTeX } from '@opendraft/references';
import { formatAPA } from '../apa-format';
import { detectPreprint } from './preprint';
import type { Reference } from '@opendraft/references';

const MINDKIND = `
@misc{mindkind2022,
  author       = {{MindKind Consortium}}, % verify: replace with full author list from medRxiv
  title        = {Young people's data governance preferences for their mental health data: {MindKind} Study findings from {India}, {South Africa} and the {United Kingdom}},
  howpublished = {medRxiv preprint},
  year         = {2022},
  doi          = {10.1101/2022.12.19.22283679}
}
`;

/** Build a minimal reference for formatter tests. */
function makeRef(
  entryType: string,
  fields: Record<string, string>,
): Reference {
  return { citeKey: 'test', entryType, fields };
}

describe('detectPreprint', () => {
  it('detects a server named alongside the word preprint', () => {
    expect(detectPreprint({ howpublished: 'medRxiv preprint' })).toEqual({
      server: 'medRxiv',
    });
  });

  it('uses the medRxiv DOI prefix when any field mentions medRxiv', () => {
    expect(
      detectPreprint({ doi: '10.1101/2022.12.19.22283679', note: 'medRxiv' }),
    ).toEqual({ server: 'medRxiv' });
  });

  it('uses bioRxiv for a 10.1101 DOI without a medRxiv mention', () => {
    expect(detectPreprint({ doi: '10.1101/2022.12.19.22283679' })).toEqual({
      server: 'bioRxiv',
    });
  });

  it('returns null for an entry with no preprint marker', () => {
    expect(detectPreprint({ title: 'A normal article' })).toBeNull();
  });
});

describe('formatAPA preprint', () => {
  it('formats the MindKind preprint entry', () => {
    const [ref] = parseBibTeX(MINDKIND);
    expect(formatAPA(ref)).toBe(
      "MindKind Consortium. (2022). *Young people's data governance preferences for their mental health data: MindKind study findings from India, South Africa and the United Kingdom* [Preprint]. medRxiv. https://doi.org/10.1101/2022.12.19.22283679",
    );
  });

  it('detects arXiv from the DOI when there is no howpublished', () => {
    const ref = makeRef('misc', {
      author: 'Doe, Jane',
      year: '2021',
      title: 'A preprint',
      doi: '10.48550/arXiv.2101.00001',
    });
    expect(formatAPA(ref)).toContain('*A preprint* [Preprint]. arXiv.');
  });
});

describe('formatAPA online source', () => {
  it('uses howpublished as the source for a non-preprint online entry', () => {
    const ref = makeRef('online', {
      author: 'Doe, Jane',
      year: '2024',
      title: 'Title',
      howpublished: 'Some Site',
      url: 'https://example.com',
    });
    expect(formatAPA(ref)).toBe(
      'Doe, J. (2024). *Title*. Some Site. https://example.com',
    );
  });
});

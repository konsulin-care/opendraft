import { describe, it, expect } from 'vitest';
import { formatAPA } from '../apa-format';
import type { Reference } from '@opendraft/references';

function makeRef(overrides: Partial<Reference> = {}): Reference {
  return {
    citeKey: 'test2024',
    entryType: 'incollection',
    fields: {
      author: 'Smith, John',
      year: '2024',
      ...overrides.fields,
    },
    ...overrides,
  };
}

describe('formatAPA chapter types with editors', () => {
  it('formats an inproceedings entry with two editors', () => {
    const ref = makeRef({
      entryType: 'inproceedings',
      fields: {
        author: 'Smith, John',
        year: '2024',
        title: 'Paper',
        editor: 'Editor, Alice and Editor, Bob',
        booktitle: 'Proceedings',
        pages: '50-60',
        publisher: 'Publisher',
      },
    });
    expect(formatAPA(ref)).toBe(
      'Smith, J. (2024). Paper. In A. Editor & B. Editor (Eds.), *Proceedings* (pp. 50–60). Publisher.',
    );
  });

  it('uses Ed. for a single editor', () => {
    const ref = makeRef({
      entryType: 'incollection',
      fields: {
        author: 'Smith, John',
        year: '2024',
        title: 'Paper',
        editor: 'Editor, Alice',
        booktitle: 'Proceedings',
        pages: '50-60',
        publisher: 'Publisher',
      },
    });
    expect(formatAPA(ref)).toContain('In A. Editor (Ed.), *Proceedings*');
  });
});

describe('formatAPA chapter types without editors', () => {
  it('omits the editor clause when there is no editor', () => {
    const ref = makeRef({
      entryType: 'inbook',
      fields: {
        author: 'Smith, John',
        year: '2024',
        title: 'Paper',
        booktitle: 'Proceedings',
        pages: '50-60',
        publisher: 'Publisher',
      },
    });
    expect(formatAPA(ref)).toContain('Paper. In *Proceedings* (pp. 50–60). Publisher.');
  });

  it('formats a conference entry like an inproceedings entry', () => {
    const ref = makeRef({
      entryType: 'conference',
      fields: {
        author: 'Smith, John',
        year: '2024',
        title: 'Paper',
        booktitle: 'Proceedings',
        pages: '50-60',
        publisher: 'Publisher',
      },
    });
    expect(formatAPA(ref)).toContain('Paper. In *Proceedings* (pp. 50–60). Publisher.');
  });
});

describe('formatAPA thesis types', () => {
  it('formats a phdthesis entry', () => {
    const ref = makeRef({
      entryType: 'phdthesis',
      fields: {
        author: 'Smith, John',
        year: '2024',
        title: 'Title',
        school: 'School',
      },
    });
    expect(formatAPA(ref)).toBe(
      'Smith, J. (2024). *Title* [Doctoral dissertation, School].',
    );
  });

  it('formats a mastersthesis entry', () => {
    const ref = makeRef({
      entryType: 'mastersthesis',
      fields: {
        author: 'Smith, John',
        year: '2024',
        title: 'Title',
        school: 'School',
      },
    });
    expect(formatAPA(ref)).toBe(
      "Smith, J. (2024). *Title* [Master's thesis, School].",
    );
  });
});

describe('formatAPA techreport', () => {
  it('formats a techreport with a report number', () => {
    const ref = makeRef({
      entryType: 'techreport',
      fields: {
        author: 'Smith, John',
        year: '2024',
        title: 'Title',
        number: '7',
        institution: 'Institution',
      },
    });
    expect(formatAPA(ref)).toBe(
      'Smith, J. (2024). *Title* (Report No. 7). Institution.',
    );
  });

  it('drops the report number when the number field is missing', () => {
    const ref = makeRef({
      entryType: 'techreport',
      fields: {
        author: 'Smith, John',
        year: '2024',
        title: 'Title',
        institution: 'Institution',
      },
    });
    expect(formatAPA(ref)).toBe('Smith, J. (2024). *Title*. Institution.');
  });
});

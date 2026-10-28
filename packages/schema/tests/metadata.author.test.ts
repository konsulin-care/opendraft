import { describe, it, expect } from 'vitest';
import { validateMetadata } from '../src/metadata.js';

const validAuthor = {
  authors: [
    {
      name: 'Jane Doe',
      orcid: '0000-0001-2345-6789',
      affiliations: [{ name: 'University Example' }],
    },
  ],
};

const fullAuthor = {
  authors: [
    {
      name: 'Josiah Carberry',
      email: 'josiah@psychoceramics.org',
      phone: '+1-401-863-1234',
      fax: '+1-401-863-1235',
      url: 'https://en.wikipedia.org/wiki/Josiah_S._Carberry',
      degrees: ['B.S.', 'PhD'],
      orcid: '0000-0002-1825-0097',
      note: 'Contributed to the theoretical framework.',
      acknowledgements: 'Thanks to the reviewers.',
      roles: ['conceptualization', 'writing-original-draft'],
      corresponding: true,
      'equal-contributor': false,
      deceased: false,
      id: 'jc',
      affiliations: [{ name: 'Brown University' }],
    },
  ],
};

const fullAffiliation = {
  authors: [
    {
      name: 'Jane',
      affiliations: [
        {
          name: 'Brown University',
          department: 'Psychoceramics',
          group: 'Advanced Studies',
          city: 'Providence',
          region: 'New England',
          state: 'RI',
          country: 'US',
          'postal-code': '02912',
          url: 'https://www.brown.edu',
          isni: '0000 0001 2019 1471',
          ringgold: '6752',
          ror: 'https://ror.org/03yrm5c26',
          id: 'brown',
        },
      ],
    },
  ],
};

describe('validateMetadata — author: basic validation', () => {
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

  it('tolerates extra fields', () => {
    const data = { authors: [{ name: 'Jane', extra: true }] };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(true);
  });
});

describe('validateMetadata — author: author/authors alias', () => {
  it('accepts author singular key', () => {
    const data = {
      author: [{ name: 'Norah Jones', email: 'norah@example.com' }],
    };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(true);
  });
});

describe('validateMetadata — author: all optional fields', () => {
  it('accepts author with all optional fields', () => {
    const result = validateMetadata(fullAuthor, 'author');
    expect(result.valid).toBe(true);
  });
});

describe('validateMetadata — author: field type validation', () => {
  it('rejects invalid orcid format', () => {
    const data = { authors: [{ name: 'Jane', orcid: 'not-an-orcid' }] };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('orcid'))).toBe(true);
  });

  it('rejects roles as string (must be array)', () => {
    const data = {
      authors: [{ name: 'Jane', roles: 'conceptualization' }],
    };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('roles'))).toBe(true);
  });

  it('rejects degrees as string (must be array)', () => {
    const data = {
      authors: [{ name: 'Jane', degrees: 'PhD' }],
    };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('degrees'))).toBe(true);
  });

  it('rejects non-string email', () => {
    const data = {
      authors: [{ name: 'Jane', email: 123 }],
    };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('email'))).toBe(true);
  });

  it('rejects non-boolean corresponding', () => {
    const data = {
      authors: [{ name: 'Jane', corresponding: 'yes' }],
    };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('corresponding'))).toBe(true);
  });
});

describe('validateMetadata — author: affiliation fields', () => {
  it('accepts affiliation with all fields', () => {
    const result = validateMetadata(fullAffiliation, 'author');
    expect(result.valid).toBe(true);
  });

  it('rejects affiliation without name', () => {
    const data = {
      authors: [
        {
          name: 'Jane',
          affiliations: [{ department: 'Physics' }],
        },
      ],
    };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('name'))).toBe(true);
  });

  it('accepts string ringgold', () => {
    const data = {
      authors: [
        {
          name: 'Jane',
          affiliations: [{ name: 'Uni', ringgold: '6752' }],
        },
      ],
    };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(true);
  });

  it('rejects numeric ringgold', () => {
    const data = {
      authors: [
        {
          name: 'Jane',
          affiliations: [{ name: 'Uni', ringgold: 6752 }],
        },
      ],
    };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('ringgold'))).toBe(true);
  });
});

describe('validateMetadata — author: schema v2 (structured names)', () => {
  it('accepts structured name with given and family', () => {
    const data = { authors: [{ name: { given: 'Alice', family: 'Smith' } }] };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(true);
  });

  it('accepts structured name with family only', () => {
    const data = { authors: [{ name: { family: 'Dewi' } }] };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(true);
  });

  it('accepts group literal name with members', () => {
    const data = {
      authors: [
        {
          name: { literal: 'WHO Diabetes Work Group' },
          members: [{ name: { family: 'Suharto' } }],
        },
      ],
    };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(true);
  });

  it('accepts string isni', () => {
    const data = {
      authors: [
        { name: 'Jane', affiliations: [{ name: 'Uni', isni: '0000 0001 2019 1471' }] },
      ],
    };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(true);
  });

  it('accepts on-behalf-of and deceased flags', () => {
    const data = {
      authors: [
        { name: { literal: 'WHO Diabetes Work Group' }, id: 'who' },
        { name: { family: 'Suharto' }, id: 'ms', 'on-behalf-of': 'who', deceased: true },
      ],
    };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(true);
  });
});

describe('validateMetadata — author: schema v2 (name validation)', () => {
  it('rejects structured name without family or literal', () => {
    const data = { authors: [{ name: { given: 'A' } }] };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('name'))).toBe(true);
  });
});

describe('validateMetadata — author: schema v2 (registry, roles, legacy)', () => {
  it('accepts affiliation refs backed by a top-level registry', () => {
    const data = {
      authors: [{ name: 'Jane Doe', affiliations: [{ ref: 'ui' }] }],
      affiliations: [{ id: 'ui', name: 'University of Indonesia' }],
    };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(true);
  });

  it('accepts legacy string name with inline affiliation', () => {
    const data = {
      authors: [{ name: 'Jane Doe', affiliations: [{ name: 'X' }] }],
    };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(true);
  });

  it('rejects unknown role outside the CRediT enum', () => {
    const data = { authors: [{ name: 'Jane', roles: ['cooking'] }] };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('roles'))).toBe(true);
  });

  it('rejects registry affiliation without id', () => {
    const data = {
      authors: [{ name: 'Jane Doe', affiliations: [{ ref: 'ui' }] }],
      affiliations: [{ name: 'University of Indonesia' }],
    };
    const result = validateMetadata(data, 'author');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes('affiliations'))).toBe(true);
  });
});

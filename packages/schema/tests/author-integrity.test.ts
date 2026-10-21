import { describe, it, expect } from 'vitest';
import { checkAuthorIntegrity } from '../src/author-integrity.js';

const validFile = {
  affiliations: [
    { id: 'ui', name: 'University of Indonesia' },
    { id: 'ei', name: 'Eijkman Institute for Molecular Biology' },
  ],
  authors: [
    {
      name: { given: 'Alice', family: 'Smith' },
      id: 'alice',
      corresponding: true,
      email: 'alice@example.org',
      affiliations: [{ ref: 'ui' }],
    },
    {
      name: { literal: 'WHO Diabetes Work Group' },
      id: 'who',
      members: [{ name: { family: 'Suharto' }, affiliations: [{ ref: 'ei' }] }],
    },
    {
      name: { family: 'Lee' },
      id: 'lee',
      'on-behalf-of': 'who',
      affiliations: [{ ref: 'ei' }],
    },
  ],
};

describe('checkAuthorIntegrity — valid file', () => {
  it('returns [] for a valid file', () => {
    expect(checkAuthorIntegrity(validFile)).toEqual([]);
  });

  it('tolerates non-object input without throwing', () => {
    expect(checkAuthorIntegrity(null)).toEqual([]);
    expect(checkAuthorIntegrity('nope')).toEqual([]);
    expect(checkAuthorIntegrity({})).toEqual([]);
  });
});

describe('checkAuthorIntegrity — affiliation refs', () => {
  it("reports ref 'xyz' unresolved at authors.0.affiliations.0.ref", () => {
    const data = {
      affiliations: [{ id: 'ui', name: 'University of Indonesia' }],
      authors: [
        { name: { given: 'Alice', family: 'Smith' }, id: 'a', affiliations: [{ ref: 'xyz' }] },
      ],
    };
    const errors = checkAuthorIntegrity(data);
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe('authors.0.affiliations.0.ref');
    expect(errors[0].message).toContain("'xyz'");
    expect(errors[0].message).toContain('unresolved');
  });

  it('reports unresolved member affiliation ref', () => {
    const data = {
      affiliations: [{ id: 'ui', name: 'University of Indonesia' }],
      authors: [
        {
          name: { literal: 'WHO DWG' },
          id: 'who',
          members: [{ name: { family: 'Suharto' }, affiliations: [{ ref: 'zz' }] }],
        },
      ],
    };
    const errors = checkAuthorIntegrity(data);
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe('authors.0.members.0.affiliations.0.ref');
    expect(errors[0].message).toContain("'zz'");
    expect(errors[0].message).toContain('unresolved');
  });
});

describe('checkAuthorIntegrity — duplicate ids', () => {
  it("reports duplicate registry id 'ui' exactly once", () => {
    const data = {
      affiliations: [
        { id: 'ui', name: 'University of Indonesia' },
        { id: 'ui', name: 'Universitas Indonesia' },
      ],
      authors: [],
    };
    const errors = checkAuthorIntegrity(data);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("duplicate registry id 'ui'");
    expect(errors[0].path).toBe('affiliations.1.id');
  });

  it('reports duplicate author id at authors.<index>.id', () => {
    const data = {
      authors: [
        { name: { given: 'Alice', family: 'Smith' }, id: 'dup' },
        { name: { family: 'Lee' }, id: 'dup' },
      ],
    };
    const errors = checkAuthorIntegrity(data);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain("duplicate author id 'dup'");
    expect(errors[0].path).toBe('authors.1.id');
  });
});

describe('checkAuthorIntegrity — on-behalf-of', () => {
  it('rejects on-behalf-of pointing to a person author', () => {
    const data = {
      authors: [
        { name: { given: 'Alice', family: 'Smith' }, id: 'alice' },
        { name: { family: 'Lee' }, id: 'lee', 'on-behalf-of': 'alice' },
      ],
    };
    const errors = checkAuthorIntegrity(data);
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe('authors.1.on-behalf-of');
    expect(errors[0].message).toContain('person');
  });

  it('rejects on-behalf-of pointing to an unknown id', () => {
    const data = {
      authors: [{ name: { family: 'Lee' }, id: 'lee', 'on-behalf-of': 'ghost' }],
    };
    const errors = checkAuthorIntegrity(data);
    expect(errors).toHaveLength(1);
    expect(errors[0].path).toBe('authors.0.on-behalf-of');
    expect(errors[0].message).toContain("'ghost'");
    expect(errors[0].message).toContain('not found');
  });

  it('accepts on-behalf-of targeting a group author with literal name', () => {
    expect(checkAuthorIntegrity(validFile)).toEqual([]);
  });
});

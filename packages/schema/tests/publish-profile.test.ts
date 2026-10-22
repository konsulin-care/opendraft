import { describe, it, expect } from 'vitest';
import { checkPublishReadiness } from '../src/publish-profile.js';
import type { PublishReadinessInput } from '../src/publish-profile.js';

const frontmatter = { title: 'Fasting glucose in type 2 diabetes', license: 'CC BY 4.0' };
const abstractDoc = { abstract: 'We measured fasting glucose over 12 weeks.' };

const authorDoc = {
  affiliations: [
    { id: 'ui', name: 'University of Indonesia', ror: 'https://ror.org/0116zj450' },
    { id: 'rscm', name: 'Radcliffe Cardiology' },
  ],
  authors: [
    {
      id: 'smith',
      name: { given: 'Alice Marie', family: 'Smith' },
      orcid: '0000-0002-1825-0097',
      email: 'alice@example.org',
      corresponding: true,
      affiliations: [{ ref: 'ui' }, { ref: 'rscm' }],
    },
    { id: 'lee', name: { given: 'Budi', family: 'Lee' }, affiliations: [{ ref: 'rscm' }] },
    {
      id: 'who',
      name: { literal: 'WHO Diabetes Work Group' },
      members: [{ name: { family: 'Suharto' } }],
    },
  ],
};

const opendraft = {
  repository: 'https://github.com/acme/paper',
  manuscripts: [{ id: 'x', path: 'manuscripts/x' }],
};

/** Build a fully valid readiness input, overriding individual documents. */
function base(overrides: Partial<PublishReadinessInput> = {}): PublishReadinessInput {
  return {
    frontmatter,
    author: authorDoc,
    abstract: abstractDoc,
    opendraft,
    manuscriptId: 'x',
    currentRepositoryUrl: 'https://github.com/acme/paper',
    ...overrides,
  };
}

describe('checkPublishReadiness — valid manuscript', () => {
  it('returns no issues when every required field is present', () => {
    expect(checkPublishReadiness(base())).toEqual([]);
  });

  it('returns no issue for missing keywords, roles, funding, subject or ORCID', () => {
    // The base fixture has no keywords/funding/subject anywhere and only
    // the first author carries an ORCID, so nothing extra may be reported.
    const noOrcid = {
      ...authorDoc,
      authors: authorDoc.authors.map((a) => ({ ...a, orcid: undefined, roles: undefined })),
    };
    expect(checkPublishReadiness(base({ author: noOrcid }))).toEqual([]);
  });
});

describe('checkPublishReadiness — commit: title, refs, ids, ORCID', () => {
  it("reports missing title as level 'commit' at path 'title'", () => {
    const issues = checkPublishReadiness(base({ frontmatter: { license: 'CC BY 4.0' } }));
    expect(issues).toContainEqual({ level: 'commit', path: 'title', message: 'missing title' });
  });

  it("reports a broken affiliation ref as level 'commit'", () => {
    const author = { ...authorDoc, authors: [{ ...authorDoc.authors[0], affiliations: [{ ref: 'xyz' }] }, ...authorDoc.authors.slice(1)] };
    const issues = checkPublishReadiness(base({ author }));
    expect(issues).toContainEqual({
      level: 'commit',
      path: 'authors.0.affiliations.0.ref',
      message: "affiliation ref 'xyz' unresolved",
    });
  });

  it("reports a duplicate registry id as level 'commit'", () => {
    const author = { ...authorDoc, affiliations: [...authorDoc.affiliations, { id: 'ui', name: 'Clone' }] };
    const issues = checkPublishReadiness(base({ author }));
    expect(issues).toContainEqual({
      level: 'commit',
      path: 'affiliations.2.id',
      message: "duplicate registry id 'ui'",
    });
  });

  it("reports an invalid ORCID format as level 'commit'", () => {
    const author = { ...authorDoc, authors: [{ ...authorDoc.authors[0], orcid: '1234' }, ...authorDoc.authors.slice(1)] };
    const issues = checkPublishReadiness(base({ author }));
    expect(issues).toContainEqual({
      level: 'commit',
      path: 'authors.0.orcid',
      message: "invalid ORCID format: '1234'",
    });
  });
});

describe('checkPublishReadiness — commit: YAML and integrity', () => {
  it("reports a YAML parse error as level 'commit' and skips that file's checks", () => {
    const issues = checkPublishReadiness(
      base({ parseErrors: { frontmatter: 'bad indentation at line 3' } }),
    );
    expect(issues).toEqual([
      {
        level: 'commit',
        path: 'frontmatter',
        message: 'YAML parse error: bad indentation at line 3',
      },
    ]);
  });

  it("reports a concept DOI bound to another repository as level 'commit'", () => {
    const issues = checkPublishReadiness(
      base({
        opendraft: {
          repository: 'https://github.com/acme/paper',
          manuscripts: [
            { id: 'x', path: 'manuscripts/x', 'concept-doi': '10.5555/od.x', 'concept-doi-repository': 'https://github.com/other/fork' },
          ],
        },
      }),
    );
    expect(issues).toContainEqual({
      level: 'commit',
      path: 'manuscripts.0.concept-doi-repository',
      message: 'concept DOI is bound to a different repository',
    });
  });
});

describe('checkPublishReadiness — commit: email and ROR format', () => {
  it("reports an invalid email as level 'commit'", () => {
    const author = {
      ...authorDoc,
      authors: [{ ...authorDoc.authors[0], email: 'not-an-email' }, ...authorDoc.authors.slice(1)],
    };
    const issues = checkPublishReadiness(base({ author }));
    expect(issues).toContainEqual({
      level: 'commit',
      path: 'authors.0.email',
      message: "invalid email: 'not-an-email'",
    });
  });

  it("reports an invalid ROR id as level 'commit'", () => {
    const author = {
      ...authorDoc,
      affiliations: [
        { id: 'ui', name: 'University of Indonesia', ror: 'not-a-ror' },
        ...authorDoc.affiliations.slice(1),
      ],
    };
    const issues = checkPublishReadiness(base({ author }));
    expect(issues).toContainEqual({
      level: 'commit',
      path: 'affiliations.0.ror',
      message: "invalid ROR id: 'not-a-ror'",
    });
  });
});

describe('checkPublishReadiness — publish: authors', () => {
  it("reports zero authors as level 'publish' at path 'authors'", () => {
    const issues = checkPublishReadiness(base({ author: { authors: [] } }));
    expect(issues).toContainEqual({ level: 'publish', path: 'authors', message: 'no authors' });
  });

  it("reports a person author without affiliation at 'authors.1.affiliations'", () => {
    const authors = authorDoc.authors.map((a, i) => (i === 1 ? { ...a, affiliations: undefined } : a));
    const issues = checkPublishReadiness(base({ author: { ...authorDoc, authors } }));
    expect(issues).toContainEqual({
      level: 'publish',
      path: 'authors.1.affiliations',
      message: 'person author has no affiliation',
    });
  });

  it('exempts group authors and their members from the affiliation rule', () => {
    // The base fixture's group author and its member have no affiliations.
    const issues = checkPublishReadiness(base());
    expect(issues.filter((i) => i.path.includes('authors.2'))).toEqual([]);
  });

  it("reports no corresponding person with email when none is flagged corresponding", () => {
    const authors = authorDoc.authors.map((a) => ({ ...a, corresponding: undefined }));
    const issues = checkPublishReadiness(base({ author: { ...authorDoc, authors } }));
    expect(issues).toContainEqual({
      level: 'publish',
      path: 'authors',
      message: 'no corresponding person with email',
    });
  });

  it('points at the corresponding person missing an email when one is flagged', () => {
    const authors = authorDoc.authors.map((a, i) => (i === 0 ? { ...a, email: undefined } : a));
    const issues = checkPublishReadiness(base({ author: { ...authorDoc, authors } }));
    expect(issues).toContainEqual({
      level: 'publish',
      path: 'authors.0.email',
      message: 'no corresponding person with email',
    });
  });
});

describe('checkPublishReadiness — publish: explicit author type', () => {
  it("treats a literal-only author with author-type person as a person for the affiliation rule", () => {
    const authors = [
      ...authorDoc.authors,
      { id: 'plato', name: { literal: 'Plato' }, metadata: { 'author-type': 'person' } },
    ];
    const issues = checkPublishReadiness(base({ author: { ...authorDoc, authors } }));
    expect(issues).toContainEqual({
      level: 'publish',
      path: 'authors.3.affiliations',
      message: 'person author has no affiliation',
    });
  });

  it('keeps legacy literal-only authors without metadata exempt as groups', () => {
    const authors = [
      ...authorDoc.authors,
      { id: 'consortium', name: { literal: 'The Consortium' } },
    ];
    const issues = checkPublishReadiness(base({ author: { ...authorDoc, authors } }));
    expect(issues.filter((i) => i.message === 'person author has no affiliation')).toEqual([]);
  });
});

describe('checkPublishReadiness — publish: repository, warnings', () => {
  it("reports a repository mismatch as level 'publish' at path 'repository'", () => {
    const issues = checkPublishReadiness(
      base({ currentRepositoryUrl: 'https://github.com/other/fork' }),
    );
    expect(issues).toContainEqual({
      level: 'publish',
      path: 'repository',
      message: 'repository mismatch: current repository is not the registered repository',
    });
  });

  it("reports missing license as level 'warning' at path 'license'", () => {
    const issues = checkPublishReadiness(base({ frontmatter: { title: 'T' } }));
    expect(issues).toContainEqual({ level: 'warning', path: 'license', message: 'missing license' });
  });

  it("reports missing abstract as level 'warning' at path 'abstract'", () => {
    const issues = checkPublishReadiness(base({ abstract: {} }));
    expect(issues).toContainEqual({ level: 'warning', path: 'abstract', message: 'missing abstract' });
  });

  it('lists commit issues before publish issues and warnings', () => {
    const issues = checkPublishReadiness(
      base({
        frontmatter: { title: '' },
        abstract: {},
        currentRepositoryUrl: 'https://github.com/other/fork',
      }),
    );
    expect(issues.map((i) => i.level)).toEqual(['commit', 'publish', 'warning', 'warning']);
  });
});

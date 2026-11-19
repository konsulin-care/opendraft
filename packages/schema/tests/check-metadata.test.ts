import { describe, it, expect } from 'vitest';
import { checkMetadata } from '../src/index.js';
import type { PublishIssue, PublishIssueLevel, PublishReadinessInput } from '../src/index.js';

/** Rank of each level in commit -> publish -> warning order. */
const LEVEL_ORDER: Record<PublishIssueLevel, number> = { commit: 0, publish: 1, warning: 2 };

const registry = [{ id: 'ui', name: 'University of Indonesia' }];

/** Fully valid documents; override individual files per test. */
function base(overrides: Partial<PublishReadinessInput> = {}): PublishReadinessInput {
  return {
    frontmatter: { title: 'Fasting glucose in type 2 diabetes', license: 'CC BY 4.0' },
    author: {
      affiliations: registry,
      authors: [
        {
          name: { given: 'Alice', family: 'Smith' },
          email: 'alice@example.org',
          corresponding: true,
          affiliations: [{ ref: 'ui' }],
        },
      ],
    },
    abstract: { abstract: 'We measured fasting glucose over 12 weeks.' },
    ...overrides,
  };
}

describe('checkMetadata — schema errors are commit issues prefixed by file key', () => {
  it('reports an author entry without name in _author.yml as a commit-level issue', () => {
    const issues = checkMetadata(
      base({
        author: {
          affiliations: registry,
          authors: [{ id: 'anon', affiliations: [{ ref: 'ui' }] }],
        },
      }),
    );
    expect(issues).toContainEqual({
      level: 'commit',
      path: 'author.authors[0].name',
      message: "must have required property 'name'",
    });
  });
});

describe('checkMetadata — integrity issues from the readiness profile', () => {
  it('reports an affiliation ref that resolves to nothing as a commit-level issue', () => {
    const issues = checkMetadata(
      base({
        author: {
          affiliations: registry,
          authors: [{ name: 'Jane Doe', affiliations: [{ ref: 'ghost' }] }],
        },
      }),
    );
    expect(issues).toContainEqual({
      level: 'commit',
      path: 'authors.0.affiliations.0.ref',
      message: "affiliation ref 'ghost' unresolved",
    });
  });
});

describe('checkMetadata — ordering and de-duplication', () => {
  it('returns publish-level and warning issues after commit-level issues, with no duplicate entries', () => {
    const issues = checkMetadata(
      base({
        frontmatter: { license: 'CC BY 4.0' }, // no title: schema + readiness commit issues
        author: { authors: [{ name: 'Jane Doe' }] }, // person without affiliation: publish issue
        abstract: {}, // missing abstract: warning
      }),
    );

    const levels = issues.map((i) => i.level);
    expect(levels).toContain('commit');
    expect(levels).toContain('publish');
    expect(levels).toContain('warning');
    const ranks = levels.map((l) => LEVEL_ORDER[l]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));

    const keys = issues.map((i: PublishIssue) => `${i.level}|${i.path}|${i.message}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

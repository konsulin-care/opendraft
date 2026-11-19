import { describe, expect, it } from 'vitest';
import { emitSectionGraph } from '../src/rdf/section-graph.js';

const PUB = 'https://example.org/pub';
const sections = [
  { short: 'intro', role: 'related-work', title: 'Intro' },
  { short: 'plain', title: 'Plain' },
];

describe('emitSectionGraph', () => {
  it('emits typed sections, hasPart and hasNext', () => {
    const ttl = emitSectionGraph({ publication: PUB, sections }).join('\n');
    expect(ttl).toContain('<https://example.org/pub#sec-intro>');
    expect(ttl).toContain('doco/Section>, <http://purl.org/spar/deo/RelatedWork>');
    expect(ttl).toContain('hasPart> <https://example.org/pub#sec-intro>, <https://example.org/pub#sec-plain>');
    expect(ttl).toContain('hasNext> <https://example.org/pub#sec-plain>');
    expect(ttl).toContain('title> "Intro"');
  });

  it('emits source only with revision and GitHub repo', () => {
    const base = { publication: PUB, sections, manuscriptPath: 'manuscripts/m1' };
    const yes = emitSectionGraph({
      ...base, repositoryUrl: 'https://github.com/o/r', sourceRevision: 'abc',
    }).join('\n');
    expect(yes).toContain('<https://raw.githubusercontent.com/o/r/abc/manuscripts/m1/blocks/_intro.qmd>');
    expect(emitSectionGraph({ ...base, repositoryUrl: 'https://github.com/o/r' }).join('')).not.toContain('source>');
    expect(emitSectionGraph({
      ...base, repositoryUrl: 'https://gitlab.com/o/r', sourceRevision: 'abc',
    }).join('')).not.toContain('source>');
  });

  it('types a generic section as doco:Section only', () => {
    const ttl = emitSectionGraph({ publication: PUB, sections }).join('\n');
    expect(ttl).toContain('a <http://purl.org/spar/doco/Section> ;');
  });
});

// @vitest-environment node
/**
 * Byline model tests: affiliation superscripts by first appearance,
 * symbol footnotes only for symbols in use, collaborators, contributions
 * and initials derivation.
 */
import { describe, expect, it } from 'vitest';
import { buildByline, initials } from './byline-model';
import type { MetadataAuthor } from './use-manuscript-metadata';

/** Affiliation registry shared by the fixtures. */
const REGISTRY = [
  { id: 'ui', name: 'University of Indonesia' },
  { id: 'rscm', name: 'RS Pondok Indah Cempaka Putih' },
  { id: 'eijkman', name: 'Eijkman Institute for Molecular Biology' },
];

/** Four authors covering shared and unique affiliations plus all symbols. */
const AUTHORS: MetadataAuthor[] = [
  {
    id: 'smith',
    name: { given: 'Alice Marie', family: 'Smith' },
    email: 'alice@example.edu',
    orcid: '0000-0002-1825-0097',
    corresponding: true,
    affiliations: [{ ref: 'ui' }, { ref: 'rscm' }],
  },
  {
    id: 'lee',
    name: { given: 'Budi', family: 'Lee' },
    'equal-contributor': true,
    affiliations: [{ ref: 'rscm' }],
  },
  {
    id: 'wu',
    name: { given: 'Wei', family: 'Wu' },
    'equal-contributor': true,
    affiliations: [{ ref: 'ui' }],
  },
  {
    id: 'dewi',
    name: { given: 'Dewi', family: 'Sari' },
    deceased: true,
    affiliations: [{ ref: 'eijkman' }],
  },
];

describe('buildByline superscripts and affiliation order', () => {
  it('numbers affiliations by first appearance in author order', () => {
    const model = buildByline(AUTHORS, REGISTRY);
    expect(model.authors.map((a) => a.superscript)).toEqual(['1,2', '2', '1', '3']);
    expect(model.affiliations.map((a) => a.id)).toEqual(['ui', 'rscm', 'eijkman']);
    expect(model.affiliations.map((a) => a.number)).toEqual([1, 2, 3]);
  });

  it('exposes the symbol flags per author', () => {
    const model = buildByline(AUTHORS, REGISTRY);
    expect(model.authors[0].corresponding).toBe(true);
    expect(model.authors[1].equal).toBe(true);
    expect(model.authors[3].deceased).toBe(true);
    expect(model.authors[1].corresponding).toBe(false);
  });

  it('keeps a stable key from the author id', () => {
    const model = buildByline(AUTHORS, REGISTRY);
    expect(model.authors.map((a) => a.key)).toEqual(['smith', 'lee', 'wu', 'dewi']);
  });
});

describe('buildByline footnotes', () => {
  it('contains only the symbol lines in use, never numbered affiliations', () => {
    const model = buildByline(AUTHORS, REGISTRY);
    expect(model.footnotes).toEqual([
      '* Corresponding author',
      '† Equal contribution',
      '‡ Deceased',
    ]);
    const joined = model.footnotes.join('\n');
    expect(joined).not.toContain('University of Indonesia');
    expect(model.footnotes.some((line) => /^\d+\./.test(line))).toBe(false);
  });

  it('keeps numbered affiliations in the affiliation list, rendered once', () => {
    const model = buildByline(AUTHORS, REGISTRY);
    expect(model.affiliations.map((a) => `${a.number}. ${a.name}`)).toEqual([
      '1. University of Indonesia',
      '2. RS Pondok Indah Cempaka Putih',
      '3. Eijkman Institute for Molecular Biology',
    ]);
  });

  it('omits symbol lines for symbols nobody uses', () => {
    const plain: MetadataAuthor[] = [
      { id: 'a', name: { given: 'Ada', family: 'Lovelace' }, affiliations: [{ ref: 'ui' }] },
    ];
    const model = buildByline(plain, REGISTRY);
    expect(model.footnotes).toEqual([]);
    expect(model.footnotes.some((line) => line.includes('†'))).toBe(false);
    expect(model.footnotes.some((line) => line.includes('‡'))).toBe(false);
    expect(model.footnotes.some((line) => line.includes('*'))).toBe(false);
  });
});

describe('buildByline collaborators and on-behalf-of', () => {
  const GROUP: MetadataAuthor[] = [
    {
      id: 'dwg',
      name: { literal: 'OpenDraft Team' },
      members: [
        { name: { given: 'Maria', family: 'Gonzalez' } },
        { name: { family: 'Suharto' } },
      ],
    },
    {
      id: 'dewi',
      name: { given: 'Dewi', family: 'Sari' },
      email: 'dewi@example.edu',
      corresponding: true,
      'on-behalf-of': 'dwg',
    },
  ];

  it('collects group authors with their member count and names', () => {
    const model = buildByline(GROUP, REGISTRY);
    expect(model.collaborators).toEqual([
      {
        key: 'dwg',
        name: 'OpenDraft Team',
        count: 2,
        members: ['Maria Gonzalez', 'Suharto'],
      },
    ]);
  });

  it('phrases a person signing on behalf of a group', () => {
    const model = buildByline(GROUP, REGISTRY);
    expect(model.authors[0].group).toBe(true);
    expect(model.authors[1].onBehalfOf).toBe('on behalf of OpenDraft Team');
  });
});

describe('buildByline contributions', () => {
  const GROUP: MetadataAuthor[] = [
    { id: 'dwg', name: { literal: 'OpenDraft Team' } },
  ];

  it('derives contribution lines with initials only when roles exist', () => {
    const model = buildByline(GROUP, REGISTRY);
    expect(model.hasContributions).toBe(false);
    expect(model.contributions).toEqual([]);

    const withRoles = buildByline(
      [
        { id: 'smith', name: { given: 'Alice Marie', family: 'Smith' }, roles: ['writing-original-draft'] },
        { id: 'lee', name: { given: 'Budi', family: 'Lee' }, roles: ['writing-original-draft', 'supervision'] },
      ],
      REGISTRY,
    );
    expect(withRoles.hasContributions).toBe(true);
    expect(withRoles.contributions).toEqual([
      'Supervision: B.L.',
      'Writing – original draft: A.M.S., B.L.',
    ]);
  });
});

describe('initials', () => {
  it('derives dotted initials from given names and family name', () => {
    expect(initials('Alice Marie', 'Smith')).toBe('A.M.S.');
    expect(initials('Budi', 'Lee')).toBe('B.L.');
  });

  it('handles a missing given name', () => {
    expect(initials('', 'Dewi')).toBe('D.');
  });
});

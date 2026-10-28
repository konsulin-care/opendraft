import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadTurtle } from '@opendraft/rdf';
import type { TurtleDataset } from '@opendraft/rdf';
import { emitAuthorshipGraph } from '../src/rdf/authorship-graph.js';
import type { AuthorObject, RegistryAffiliation } from '../src/types/author.js';

const PUB = 'https://doi.org/10.5555/example-2026';
const ALICE_IRI = 'https://orcid.org/0000-0002-1825-0097';
const PRO = 'http://purl.org/spar/pro/';
const SCORO = 'http://purl.org/spar/scoro/';
const OCO = 'https://w3id.org/oc/ontology/';
const FOAF = 'http://xmlns.com/foaf/0.1/';
const DCTERMS = 'http://purl.org/dc/terms/';
const DATACITE = 'http://purl.org/datacite/ontology/';
const LITERAL = 'https://w3id.org/literal/';
const OD = 'urn:opendraft:ontology#';
const CREDIT = 'https://credit.niso.org/contributor-roles/';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

// Four-author fixture: ORCID corresponding person, non-ORCID person,
// equal contributor, group with 2 members and on-behalf-of.
const AUTHORS: AuthorObject[] = [
  {
    id: 'alice',
    name: { given: 'Alice Marie', family: 'Smith' },
    orcid: '0000-0002-1825-0097',
    email: 'alice.smith@example.edu',
    corresponding: true,
    'equal-contributor': true,
    roles: ['conceptualization', 'writing-original-draft'],
    affiliations: [{ ref: 'ui' }, { ref: 'rscm' }],
  },
  {
    id: 'budi',
    name: { given: 'Budi', family: 'Lee' },
    email: 'budi.lee@example.edu',
    'equal-contributor': true,
    'on-behalf-of': 'wdwg',
    affiliations: [{ ref: 'rscm' }],
    roles: ['investigation', 'software'],
  },
  {
    id: 'vina',
    name: { given: 'Vina', family: 'Wu' },
    deceased: true,
    affiliations: [{ ref: 'ui' }],
    roles: ['methodology'],
  },
  {
    id: 'wdwg',
    name: { literal: 'WHO Diabetes Work Group' },
    members: [
      { name: { given: 'Sari', family: 'Wijaya' } },
      { name: 'Dewi Suharto' },
    ],
  },
];

const REGISTRY: RegistryAffiliation[] = [
  { id: 'ui', name: 'Universitas Indonesia', city: 'Depok', country: 'ID', ror: '0116zj450' },
  { id: 'rscm', name: 'Research Center for Climate Science', ror: 'https://ror.org/05dxgng32' },
];

interface Seen {
  s: string;
  skind: string;
  p: string;
  o: string;
  kind: string;
  datatype?: string;
}

let seen: Seen[] = [];
let chain: string[] = [];
let holders: string[] = [];

/** Parse an emitted Turtle fragment via a temp file. */
async function loadFragment(turtle: string): Promise<TurtleDataset> {
  const dir = await mkdtemp(join(tmpdir(), 'authorship-'));
  const file = join(dir, 'fragment.ttl');
  await writeFile(file, turtle, 'utf8');
  return loadTurtle(file);
}

/** Emit a one-author graph and parse it into Seen rows. */
async function singleAuthorSeen(author: AuthorObject): Promise<Seen[]> {
  const turtle = emitAuthorshipGraph({ publication: PUB, authors: [author] });
  const quads = [...(await loadFragment(turtle))];
  return quads.map((q) => ({
    s: q.subject.value,
    skind: q.subject.termType,
    p: q.predicate.value,
    o: q.object.value,
    kind: q.object.termType,
    datatype: q.object.termType === 'Literal' ? q.object.datatype.value : undefined,
  }));
}

/** Follow oco:hasNext from the unique head; returns the visited chain. */
function walkChain(authorRoles: string[]): string[] {
  const head = authorRoles.find((role) => subjects(`${OCO}hasNext`, role).length === 0);
  if (!head) return [];
  const visited: string[] = [];
  let current: string | undefined = head;
  while (current && !visited.includes(current)) {
    visited.push(current);
    const next = values(current, `${OCO}hasNext`);
    current = next.length > 0 ? next[0] : undefined;
  }
  return visited;
}

function objs(subject: string, predicate: string): Seen[] {
  return seen.filter((q) => q.s === subject && q.p === predicate);
}

function values(subject: string, predicate: string): string[] {
  return objs(subject, predicate).map((q) => q.o);
}

function subjects(predicate: string, object: string): string[] {
  return seen.filter((q) => q.p === predicate && q.o === object).map((q) => q.s);
}

beforeAll(async () => {
  const turtle = emitAuthorshipGraph({ publication: PUB, authors: AUTHORS, affiliations: REGISTRY });
  seen = [...(await loadFragment(turtle))].map((q) => ({
    s: q.subject.value,
    skind: q.subject.termType,
    p: q.predicate.value,
    o: q.object.value,
    kind: q.object.termType,
    datatype: q.object.termType === 'Literal' ? q.object.datatype.value : undefined,
  }));
  chain = walkChain(subjects(`${PRO}withRole`, `${PRO}author`));
  holders = chain.map((role) => values(role, `${PRO}isHeldBy`)[0] ?? '');
});

describe('author roles and order', () => {
  it('emits exactly four pro:author roles', () => {
    expect(subjects(`${PRO}withRole`, `${PRO}author`)).toHaveLength(4);
  });

  it('forms one oco:hasNext chain in YAML order with no cycle', () => {
    const authorRoles = subjects(`${PRO}withRole`, `${PRO}author`);
    expect(chain).toHaveLength(4);
    expect(new Set(chain).size).toBe(4);
    expect(authorRoles.every((role) => chain.includes(role))).toBe(true);
    for (const role of chain) {
      expect(values(role, `${OCO}hasNext`).length).toBeLessThanOrEqual(1);
      expect(subjects(`${OCO}hasNext`, role).length).toBeLessThanOrEqual(1);
    }
  });

  it('holds roles by the ORCID person and blank nodes for the rest', () => {
    expect(holders[0]).toBe(ALICE_IRI);
    const alice = seen.find((q) => q.s === holders[0] && q.p === RDF_TYPE);
    expect(alice?.o).toBe(`${FOAF}Person`);
    for (const holder of holders.slice(1)) {
      expect(seen.find((q) => q.s === holder && q.p === RDF_TYPE)?.skind).toBe('BlankNode');
    }
  });
});

describe('role flags and agents', () => {
  it('gives the corresponding author holder a foaf:mbox', () => {
    const corr = subjects(`${PRO}withRole`, `${SCORO}corresponding-author`);
    expect(corr).toEqual([chain[0]]);
    expect(values(holders[0], `${FOAF}mbox`)).toContain('mailto:alice.smith@example.edu');
  });

  it('emits no foaf:mbox for non-corresponding persons', () => {
    expect(seen.filter((q) => q.p === `${FOAF}mbox`)).toHaveLength(1);
  });

  it('links equal contributors pairwise via scoro:isEqualToRoleInTime', () => {
    const links = seen.filter((q) => q.p === `${SCORO}isEqualToRoleInTime`);
    expect(links.map((q) => `${q.s}->${q.o}`).sort()).toEqual(
      [`${chain[0]}->${chain[1]}`, `${chain[1]}->${chain[0]}`].sort(),
    );
  });

  it('records od:onBehalfOf and models the group with members', () => {
    const group = values(chain[1], `${OD}onBehalfOf`)[0] ?? '';
    expect(seen.find((q) => q.s === group && q.p === RDF_TYPE)?.o).toBe(`${FOAF}Group`);
    expect(values(group, `${FOAF}name`)).toEqual(['WHO Diabetes Work Group']);
    const members = values(group, `${FOAF}member`);
    expect(members).toHaveLength(2);
    for (const member of members) {
      expect(values(member, RDF_TYPE)).toContain(`${FOAF}Person`);
    }
    expect(seen.some((q) => q.s === members[1] && q.p === `${FOAF}name` && q.o === 'Dewi Suharto'))
      .toBe(true);
  });

  it('flags deceased authors with od:isDeceased', () => {
    const quad = seen.find((q) => q.s === holders[2] && q.p === `${OD}isDeceased`);
    expect(quad?.o).toBe('true');
    expect(quad?.datatype).toBe('http://www.w3.org/2001/XMLSchema#boolean');
  });
});

describe('identifiers, organizations and shortcuts', () => {
  it('adds an OCDM orcid identifier node beside the ORCID IRI', () => {
    const node = values(ALICE_IRI, `${DATACITE}hasIdentifier`)[0] ?? '';
    expect(values(node, `${DATACITE}usesIdentifierScheme`)).toEqual([`${DATACITE}orcid`]);
    expect(values(node, `${LITERAL}hasLiteralValue`)).toEqual(['0000-0002-1825-0097']);
  });

  it('adds datacite:ror identifier nodes for ROR organizations', () => {
    for (const [iri, id] of [['https://ror.org/0116zj450', '0116zj450'], ['https://ror.org/05dxgng32', '05dxgng32']]) {
      const node = values(iri, `${DATACITE}hasIdentifier`)[0] ?? '';
      expect(values(node, `${DATACITE}usesIdentifierScheme`)).toEqual([`${DATACITE}ror`]);
      expect(values(node, `${LITERAL}hasLiteralValue`)).toEqual([id]);
      expect(seen.find((q) => q.s === iri && q.p === RDF_TYPE)?.o).toBe(`${FOAF}Organization`);
    }
  });

  it('reuses one organization node for affiliations shared between authors', () => {
    const affiliates = subjects(`${PRO}withRole`, `${SCORO}affiliate`);
    expect(affiliates).toHaveLength(4);
    const orgs = affiliates.map((role) => values(role, `${PRO}relatesToOrganization`)[0] ?? '');
    expect(new Set(orgs)).toEqual(new Set(['https://ror.org/0116zj450', 'https://ror.org/05dxgng32']));
    expect(orgs.filter((org) => org === 'https://ror.org/05dxgng32')).toHaveLength(2);
  });

  it('emits exactly four dcterms:creator triples on the publication', () => {
    const creators = objs(PUB, `${DCTERMS}creator`);
    expect(creators).toHaveLength(4);
    expect(creators.map((q) => q.o)).toContain(ALICE_IRI);
  });

  it('restricts CRediT role IRIs to the NISO namespace', () => {
    const creditRoles = seen.filter((q) => q.p === `${PRO}withRole` && q.o.startsWith(CREDIT));
    expect(creditRoles).toHaveLength(5);
    expect(creditRoles.every((q) => q.kind === 'NamedNode')).toBe(true);
  });

  it('lists every author and affiliate role in the publication context', () => {
    const context = values(PUB, `${PRO}isDocumentContextFor`);
    expect(context).toHaveLength(8);
    expect(chain.every((role) => context.includes(role))).toBe(true);
  });
});

describe('single-name authors and explicit author type', () => {
  it('emits a literal-only name with author-type person as foaf:Person', async () => {
    const rows = await singleAuthorSeen({
      name: { literal: 'Plato' },
      metadata: { 'author-type': 'person' },
    });
    const person = rows.find((q) => q.p === RDF_TYPE && q.o === `${FOAF}Person`);
    expect(person).toBeDefined();
    expect(person?.skind).toBe('BlankNode');
    expect(rows.filter((q) => q.p === RDF_TYPE && q.o === `${FOAF}Group`)).toHaveLength(0);
    expect(rows.filter((q) => q.p === `${FOAF}name`).map((q) => q.o)).toEqual(['Plato']);
  });

  it('emits author-type group as foaf:Group with its name', async () => {
    const rows = await singleAuthorSeen({
      name: { literal: 'Plato Collective' },
      metadata: { 'author-type': 'group' },
    });
    expect(rows.find((q) => q.p === RDF_TYPE && q.o === `${FOAF}Group`)).toBeDefined();
    expect(rows.filter((q) => q.p === RDF_TYPE && q.o === `${FOAF}Person`)).toHaveLength(0);
    expect(rows.filter((q) => q.p === `${FOAF}name`).map((q) => q.o)).toEqual(['Plato Collective']);
  });

  it('keeps legacy literal-only names without author-type as foaf:Group', async () => {
    const rows = await singleAuthorSeen({ name: { literal: 'Legacy Consortium' } });
    expect(rows.find((q) => q.p === RDF_TYPE && q.o === `${FOAF}Group`)).toBeDefined();
    expect(rows.filter((q) => q.p === RDF_TYPE && q.o === `${FOAF}Person`)).toHaveLength(0);
  });
});

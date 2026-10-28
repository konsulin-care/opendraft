import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadTurtle, validateShacl } from '@opendraft/rdf';
import type { ShaclValidationReport, TurtleDataset } from '@opendraft/rdf';
import { compilePublicationGraph } from '../src/rdf/publication-graph.js';
import type { PublicationGraphInput } from '../src/rdf/publication-graph.js';
import type { AuthorObject, RegistryAffiliation } from '../src/types/author.js';

const ARTICLE_SHAPES = 'protocol/article.shacl.ttl';
const SH_VIOLATION = 'http://www.w3.org/ns/shacl#Violation';
const SH_WARNING = 'http://www.w3.org/ns/shacl#Warning';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const DCTERMS = 'http://purl.org/dc/terms/';
const FABIO = 'http://purl.org/spar/fabio/';
const PRISM = 'http://prismstandard.org/namespaces/basic/2.0/';
const FRAPO = 'http://purl.org/spar/frapo/';
const CITO = 'http://purl.org/spar/cito/';
const FRBR = 'http://purl.org/vocab/frbr/core#';
const DATACITE = 'http://purl.org/datacite/ontology/';
const LITERAL = 'https://w3id.org/literal/';
const OD = 'urn:opendraft:ontology#';
const SKOS = 'http://www.w3.org/2004/02/skos/core#';
const XSD = 'http://www.w3.org/2001/XMLSchema#';

const VERSION_DOI = '10.5555/example-2026';
const VERSION_IRI = `https://doi.org/${VERSION_DOI}`;
const CONCEPT_DOI = '10.5555/example-opendraft-concept';
const CONCEPT_IRI = `https://doi.org/${CONCEPT_DOI}`;
const PREVIOUS_IRI = 'https://doi.org/10.5555/example-2026-v1';

// Four-author fixture shared with the authorship graph suite.
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

const FULL: PublicationGraphInput = {
  title: 'Example Publication: OpenDraft Protocol',
  abstract: 'A canonical example publication used to demonstrate the OpenDraft protocol.',
  keywords: ['distributed scientific publication', 'research data'],
  license: 'CC BY 4.0',
  funding: 'OpenDraft Example Grant',
  subject: {
    text: 'Distributed scientific publication',
    authority: 'https://example.org/subjects/',
    term: 'distributed-scientific-publication',
  },
  authors: AUTHORS,
  affiliations: REGISTRY,
  repositoryUrl: 'https://github.com/konsulin-care/opendraft',
  manuscriptPath: 'manuscripts/distributed-scientific-publication/article.qmd',
  sourceRevision: '1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d',
  protocolRevision: '0000000000000000000000000000000000000000',
  versionDoi: VERSION_DOI,
  conceptDoi: CONCEPT_DOI,
  previousVersionDoi: '10.5555/example-2026-v1',
  references: ['https://doi.org/10.5555/Related-Study-2025'],
};

interface Seen {
  s: string;
  p: string;
  o: string;
}

let turtle = '';
let seen: Seen[] = [];
let shapes: TurtleDataset;
let report: ShaclValidationReport;

/** Parse an emitted Turtle string via a temp file. */
async function parseFragment(text: string): Promise<TurtleDataset> {
  const dir = await mkdtemp(join(tmpdir(), 'publication-'));
  const file = join(dir, 'graph.ttl');
  await writeFile(file, text, 'utf8');
  return loadTurtle(file);
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

function violations(current: ShaclValidationReport): typeof current.results {
  return current.results.filter((r) => r.severity.value === SH_VIOLATION);
}

beforeAll(async () => {
  turtle = compilePublicationGraph(FULL);
  const dataset = await parseFragment(turtle);
  seen = [...dataset].map((q) => ({
    s: q.subject.value,
    p: q.predicate.value,
    o: q.object.value,
  }));
  shapes = await loadTurtle(ARTICLE_SHAPES);
  report = await validateShacl(dataset, shapes);
});

describe('SHACL conformance and determinism', () => {
  it('conforms to protocol/article.shacl.ttl', () => {
    expect(violations(report)).toHaveLength(0);
    expect(report.conforms).toBe(true);
    expect(report.results).toHaveLength(0);
  });

  it('is byte-identical across two runs', () => {
    expect(compilePublicationGraph(FULL)).toBe(turtle);
  });

  it('rejects an invalid version or concept DOI', () => {
    expect(() => compilePublicationGraph({ ...FULL, versionDoi: 'not-a-doi' }))
      .toThrow('versionDoi');
    expect(() => compilePublicationGraph({ ...FULL, conceptDoi: 'not-a-doi' }))
      .toThrow('conceptDoi');
  });
});

describe('Work and version identity', () => {
  it('realizes a fabio:Work whose IRI differs from the publication IRI', () => {
    expect(subjects(RDF_TYPE, `${OD}Publication`)).toEqual([VERSION_IRI]);
    expect(subjects(RDF_TYPE, `${FABIO}Work`)).toContain(CONCEPT_IRI);
    expect(CONCEPT_IRI).not.toBe(VERSION_IRI);
    expect(values(VERSION_IRI, `${FRBR}realizationOf`)).toEqual([CONCEPT_IRI]);
    expect(subjects(RDF_TYPE, `${FABIO}Work`)).not.toContain(VERSION_IRI);
  });

  it('carries the concept DOI on the Work and the version DOI on the publication', () => {
    expect(values(CONCEPT_IRI, `${DCTERMS}identifier`)).toEqual([CONCEPT_IRI]);
    expect(values(VERSION_IRI, `${DCTERMS}identifier`)).toEqual([VERSION_IRI]);
  });

  it('revises the previous version and declares the version identifier', () => {
    expect(values(VERSION_IRI, `${FRBR}revisionOf`)).toEqual([PREVIOUS_IRI]);
    expect(values(VERSION_IRI, `${PRISM}versionIdentifier`)).toEqual(['2']);
  });

  it('defaults the version identifier to 1 without a previous version', async () => {
    const firstVersion: PublicationGraphInput = { ...FULL, previousVersionDoi: undefined };
    const data = await parseFragment(compilePublicationGraph(firstVersion));
    const version = [...data].find(
      (q) => q.subject.value === VERSION_IRI && q.predicate.value === `${PRISM}versionIdentifier`,
    );
    expect(version?.object.value).toBe('1');
  });
});

describe('publication properties', () => {
  it('emits title, abstract, keywords and a canonical license URI', () => {
    expect(values(VERSION_IRI, `${DCTERMS}title`)).toEqual([FULL.title]);
    expect(values(VERSION_IRI, `${DCTERMS}abstract`)).toEqual([FULL.abstract]);
    expect(values(VERSION_IRI, `${PRISM}keyword`)).toEqual([
      'distributed scientific publication',
      'research data',
    ]);
    expect(values(VERSION_IRI, `${DCTERMS}license`))
      .toEqual(['http://creativecommons.org/licenses/by/4.0/']);
  });

  it('funds the publication with a FRAPO grant', () => {
    const grant = values(VERSION_IRI, `${FRAPO}isFundedBy`)[0] ?? '';
    expect(values(grant, RDF_TYPE)).toContain(`${FRAPO}Grant`);
    expect(values(grant, `${DCTERMS}title`)).toEqual(['OpenDraft Example Grant']);
  });

  it('links a SKOS subject term via fabio:hasSubjectTerm and dcterms:subject', () => {
    const term = 'https://example.org/subjects/distributed-scientific-publication';
    expect(values(VERSION_IRI, `${FABIO}hasSubjectTerm`)).toEqual([term]);
    expect(values(VERSION_IRI, `${DCTERMS}subject`)).toEqual([term]);
    expect(values(term, RDF_TYPE)).toContain(`${FABIO}SubjectTerm`);
    expect(values(term, RDF_TYPE)).toContain(`${SKOS}Concept`);
    expect(values(term, `${SKOS}prefLabel`)).toEqual(['Distributed scientific publication']);
  });

});

describe('provenance and citations', () => {
  it('carries provenance scalars and an OCDM DOI identifier node', () => {
    expect(values(VERSION_IRI, `${OD}repositoryUrl`))
      .toEqual(['https://github.com/konsulin-care/opendraft']);
    expect(values(VERSION_IRI, `${OD}manuscriptPath`))
      .toEqual(['manuscripts/distributed-scientific-publication/article.qmd']);
    expect(values(VERSION_IRI, `${OD}sourceRevision`)).toEqual([FULL.sourceRevision]);
    expect(values(VERSION_IRI, `${OD}protocolRevision`)).toEqual([FULL.protocolRevision]);
    const node = values(VERSION_IRI, `${DATACITE}hasIdentifier`)[0] ?? '';
    expect(values(node, `${DATACITE}usesIdentifierScheme`)).toEqual([`${DATACITE}doi`]);
    expect(values(node, `${LITERAL}hasLiteralValue`)).toEqual([VERSION_DOI]);
  });

  it('cites reference DOIs as normalized lowercase https IRIs', () => {
    expect(values(VERSION_IRI, `${CITO}cites`)).toEqual(['https://doi.org/10.5555/related-study-2025']);
  });

  it('keeps provenance literal datatypes for the repository URL', async () => {
    const quad = [...(await parseFragment(turtle))]
      .find((q) => q.subject.value === VERSION_IRI
        && q.predicate.value === `${OD}repositoryUrl`);
    expect(quad?.object.termType).toBe('Literal');
    if (quad?.object.termType !== 'Literal') return;
    expect(quad.object.datatype.value).toBe(`${XSD}anyURI`);
  });
});

describe('missing license', () => {
  let noLicense: ShaclValidationReport;

  beforeAll(async () => {
    const withoutLicense: PublicationGraphInput = { ...FULL, license: undefined };
    const data = await parseFragment(compilePublicationGraph(withoutLicense));
    noLicense = await validateShacl(data, shapes);
  });

  it('still conforms with exactly one warning result', () => {
    expect(violations(noLicense)).toHaveLength(0);
    expect(noLicense.results).toHaveLength(1);
    expect(noLicense.results[0]?.severity.value).toBe(SH_WARNING);
    expect(noLicense.results[0]?.path?.value).toBe(`${DCTERMS}license`);
  });
});

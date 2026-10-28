/**
 * Ontology term conformance (behavior A1).
 *
 * Loads protocol/opendraft.ttl and asserts the SPAR/OCDM alignment:
 * - od:Publication is a subclass of fabio:Expression
 * - deleted terms (od:PublicationVersion, od:hasSubject,
 *   od:isCorrespondingAuthor, od:creditRole) have no triples
 * - exactly 14 NISO CRediT role IRIs are declared as pro:Role
 * - od:isDeceased and od:onBehalfOf are declared
 * - no owl:imports triple (reference-only prefixes)
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { loadTurtle, type TurtleDataset } from '@opendraft/rdf';

type Quad = TurtleDataset extends Iterable<infer Q> ? Q : never;

const ONTOLOGY = 'protocol/opendraft.ttl';

const OD = 'urn:opendraft:ontology#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const RDFS_SUBCLASS_OF = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
const RDFS_DOMAIN = 'http://www.w3.org/2000/01/rdf-schema#domain';
const RDFS_RANGE = 'http://www.w3.org/2000/01/rdf-schema#range';
const RDFS_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label';
const OWL_CLASS = 'http://www.w3.org/2002/07/owl#Class';
const OWL_DATATYPE_PROPERTY = 'http://www.w3.org/2002/07/owl#DatatypeProperty';
const OWL_OBJECT_PROPERTY = 'http://www.w3.org/2002/07/owl#ObjectProperty';
const OWL_IMPORTS = 'http://www.w3.org/2002/07/owl#imports';
const XSD_BOOLEAN = 'http://www.w3.org/2001/XMLSchema#boolean';
const FOAF_PERSON = 'http://xmlns.com/foaf/0.1/Person';
const FOAF_AGENT = 'http://xmlns.com/foaf/0.1/Agent';
const PRO_ROLE = 'http://purl.org/spar/pro/Role';
const PRO_ROLE_IN_TIME = 'http://purl.org/spar/pro/RoleInTime';
const FABIO_EXPRESSION = 'http://purl.org/spar/fabio/Expression';
const FABIO_SUBJECT_TERM = 'http://purl.org/spar/fabio/SubjectTerm';

const CREDIT = 'https://credit.niso.org/contributor-roles/';

/** Deleted od: terms that must not appear as subjects (ADR-018 precedent). */
const DELETED_TERMS = ['PublicationVersion', 'hasSubject', 'isCorrespondingAuthor', 'creditRole'];

/** Namespaces that must only be referenced, never defined, by the ontology. */
const REFERENCE_ONLY_NAMESPACES = [
  'http://purl.org/spar/fabio',
  'http://purl.org/vocab/frbr/core#',
  'http://purl.org/spar/pro/',
  'http://purl.org/spar/scoro/',
  'https://w3id.org/oc/ontology/',
  'http://prismstandard.org/namespaces/basic/2.0/',
  'http://purl.org/spar/frapo/',
  'http://purl.org/spar/cito/',
  'http://purl.org/datacite/ontology/',
  'https://w3id.org/literal/',
];

let quads: Quad[];

/** Returns every quad with the given subject IRI. */
function withSubject(iri: string): Quad[] {
  return quads.filter((quad) => quad.subject.value === iri);
}

/** Returns true when the (subject, predicate, object) triple exists. */
function hasTriple(subject: string, predicate: string, object: string): boolean {
  return quads.some(
    (quad) =>
      quad.subject.value === subject &&
      quad.predicate.value === predicate &&
      quad.object.value === object,
  );
}

/** Distinct subject IRIs under the NISO CRediT namespace. */
function creditSubjectIris(): string[] {
  return [...new Set(quads.filter(isCreditQuad).map((quad) => quad.subject.value))];
}

/** True for any quad whose subject lives under the CRediT namespace. */
function isCreditQuad(quad: Quad): boolean {
  return quad.subject.value.startsWith(CREDIT);
}

/** True for any quad whose subject lives in a reference-only namespace. */
function isReferenceOnlyQuad(quad: Quad): boolean {
  return REFERENCE_ONLY_NAMESPACES.some((ns) => quad.subject.value.startsWith(ns));
}

beforeAll(async () => {
  quads = [...(await loadTurtle(ONTOLOGY))];
});

describe('protocol/opendraft.ttl class hierarchy', () => {
  it('declares od:Publication rdfs:subClassOf fabio:Expression', () => {
    expect(hasTriple(`${OD}Publication`, RDFS_SUBCLASS_OF, FABIO_EXPRESSION)).toBe(true);
    expect(hasTriple(`${OD}Publication`, RDF_TYPE, OWL_CLASS)).toBe(true);
  });

  it('gives od:assignedSubject the range fabio:SubjectTerm', () => {
    expect(hasTriple(`${OD}assignedSubject`, RDF_TYPE, OWL_OBJECT_PROPERTY)).toBe(true);
    expect(hasTriple(`${OD}assignedSubject`, RDFS_RANGE, FABIO_SUBJECT_TERM)).toBe(true);
  });
});

describe('protocol/opendraft.ttl deleted terms', () => {
  it('has no triple with a deleted term as subject', () => {
    for (const term of DELETED_TERMS) {
      expect(withSubject(`${OD}${term}`)).toEqual([]);
    }
  });
});

describe('protocol/opendraft.ttl CRediT alignment', () => {
  it('declares exactly 14 NISO CRediT role IRIs as pro:Role', () => {
    const subjects = creditSubjectIris();
    expect(subjects.length).toBe(14);
    const typed = subjects.filter((iri) => hasTriple(iri, RDF_TYPE, PRO_ROLE));
    expect(typed.length).toBe(14);
  });

  it('labels every CRediT role', () => {
    for (const iri of creditSubjectIris()) {
      expect(withSubject(iri).some((quad) => quad.predicate.value === RDFS_LABEL)).toBe(true);
    }
  });
});

describe('protocol/opendraft.ttl author properties', () => {
  it('declares od:isDeceased as a boolean property of foaf:Person', () => {
    const deceased = withSubject(`${OD}isDeceased`);
    expect(deceased.some((quad) => quad.object.value === OWL_DATATYPE_PROPERTY)).toBe(true);
    expect(hasTriple(`${OD}isDeceased`, RDFS_RANGE, XSD_BOOLEAN)).toBe(true);
    expect(hasTriple(`${OD}isDeceased`, RDFS_DOMAIN, FOAF_PERSON)).toBe(true);
  });

  it('declares od:onBehalfOf from pro:RoleInTime to foaf:Agent', () => {
    const onBehalfOf = withSubject(`${OD}onBehalfOf`);
    expect(onBehalfOf.some((quad) => quad.object.value === OWL_OBJECT_PROPERTY)).toBe(true);
    expect(hasTriple(`${OD}onBehalfOf`, RDFS_DOMAIN, PRO_ROLE_IN_TIME)).toBe(true);
    expect(hasTriple(`${OD}onBehalfOf`, RDFS_RANGE, FOAF_AGENT)).toBe(true);
  });
});

describe('protocol/opendraft.ttl reference-only prefixes', () => {
  it('contains no owl:imports triple', () => {
    expect(quads.filter((quad) => quad.predicate.value === OWL_IMPORTS)).toEqual([]);
  });

  it('defines no subjects in reference-only namespaces', () => {
    const offending = quads.filter(isReferenceOnlyQuad).map((quad) => quad.subject.value);
    expect(offending).toEqual([]);
  });
});

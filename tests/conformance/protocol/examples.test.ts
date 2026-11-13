/**
 * Example article conformance (behavior T22).
 *
 * Loads protocol/examples/article.ttl and asserts the subject assignment
 * is recorded as a W3C Web Annotation instead of the deleted
 * od:SubjectAssignment reification:
 * - exactly one oa:Annotation motivated by oa:classifying
 * - oa:hasTarget points at the publication, oa:hasBody at the subject term
 * - dcterms:creator names the assigning agent
 * - dcterms:created carries an xsd:dateTime timestamp
 * - none of the deleted reification terms appear in the file
 */
import { readFile } from 'node:fs/promises';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadTurtle, type TurtleDataset } from '@opendraft/rdf';

type Quad = TurtleDataset extends Iterable<infer Q> ? Q : never;

const EXAMPLE = 'protocol/examples/article.ttl';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const OA = 'http://www.w3.org/ns/oa#';
const OA_ANNOTATION = `${OA}Annotation`;
const OA_MOTIVATED_BY = `${OA}motivatedBy`;
const OA_CLASSIFYING = `${OA}classifying`;
const OA_HAS_TARGET = `${OA}hasTarget`;
const OA_HAS_BODY = `${OA}hasBody`;
const DCTERMS_CREATOR = 'http://purl.org/dc/terms/creator';
const DCTERMS_CREATED = 'http://purl.org/dc/terms/created';
const XSD_DATETIME = 'http://www.w3.org/2001/XMLSchema#dateTime';
const SKOS_CONCEPT = 'http://www.w3.org/2004/02/skos/core#Concept';
const FABIO_SUBJECT_TERM = 'http://purl.org/spar/fabio/SubjectTerm';

/** Deleted od: subject-assignment reification terms (replaced by oa:). */
const DELETED_REIFICATION_TERMS = [
  'od:SubjectAssignment',
  'od:hasAssignment',
  'od:assignedSubject',
  'od:assignedBy',
  'od:assignedAt',
];

let quads: Quad[];
let raw = '';

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

/** IRI of the object of the first (subject, predicate) pair, else null. */
function objectIri(subject: string, predicate: string): string | null {
  const quad = quads.find(
    (q) => q.subject.value === subject && q.predicate.value === predicate,
  );
  return quad ? quad.object.value : null;
}

/** IRI of the sole oa:Annotation motivated by oa:classifying. */
function annotationIri(): string {
  const motivated = quads.filter(
    (quad) =>
      quad.predicate.value === OA_MOTIVATED_BY && quad.object.value === OA_CLASSIFYING,
  );
  expect(motivated).toHaveLength(1);
  const iri = motivated[0].subject.value;
  expect(hasTriple(iri, RDF_TYPE, OA_ANNOTATION)).toBe(true);
  return iri;
}

beforeAll(async () => {
  quads = [...(await loadTurtle(EXAMPLE))];
  raw = await readFile(EXAMPLE, 'utf8');
});

describe('protocol/examples/article.ttl reification removal', () => {
  it('contains none of the deleted od: subject-assignment terms', () => {
    for (const term of DELETED_REIFICATION_TERMS) {
      expect(raw).not.toContain(term);
    }
  });
});

describe('protocol/examples/article.ttl subject assignment annotation', () => {
  it('records exactly one oa:Annotation motivated by oa:classifying', () => {
    annotationIri();
  });

  it('targets the publication and has the subject term as body', () => {
    const annotation = annotationIri();
    const target = objectIri(annotation, OA_HAS_TARGET);
    expect(target).not.toBeNull();
    expect(
      withSubject(target as string).some(
        (quad) => quad.predicate.value === RDF_TYPE && quad.object.value.endsWith('Publication'),
      ),
    ).toBe(true);

    const body = objectIri(annotation, OA_HAS_BODY);
    expect(body).not.toBeNull();
    expect(
      withSubject(body as string).some(
        (quad) =>
          quad.predicate.value === RDF_TYPE &&
          (quad.object.value === SKOS_CONCEPT || quad.object.value === FABIO_SUBJECT_TERM),
      ),
    ).toBe(true);
  });

  it('records the assigning agent and an xsd:dateTime timestamp', () => {
    const annotation = annotationIri();

    const creator = objectIri(annotation, DCTERMS_CREATOR);
    expect(creator).toMatch(/^https?:/);

    const created = quads.find(
      (quad) =>
        quad.subject.value === annotation && quad.predicate.value === DCTERMS_CREATED,
    );
    expect(created).toBeDefined();
    expect(
      created?.object !== undefined && 'datatype' in created.object
        ? created.object.datatype?.value
        : undefined,
    ).toBe(XSD_DATETIME);
  });
});

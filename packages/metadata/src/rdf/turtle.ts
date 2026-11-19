/**
 * Shared Turtle emission helpers and namespace constants for the RDF
 * graph compilers (ADR-021). Extracted from authorship-graph.ts and
 * publication-graph.ts so both emit through one code path; the emitted
 * Turtle is byte-identical to the previous inlined copies.
 */

// Namespace constants include the opening angle bracket so that
// `${PRO}withRole>` expands to a wrapped Turtle IRI reference.
/** pro: role vocabulary. */
export const PRO = '<http://purl.org/spar/pro/';
/** scoro: agent/role vocabulary. */
export const SCORO = '<http://purl.org/spar/scoro/';
/** oco: ordering vocabulary (oco:hasNext). */
export const OCO = '<https://w3id.org/oc/ontology/';
/** foaf: agents and organizations. */
export const FOAF = '<http://xmlns.com/foaf/0.1/';
/** dcterms: descriptive properties. */
export const DCTERMS = '<http://purl.org/dc/terms/';
/** fabio: FRBR work/expression vocabulary. */
export const FABIO = '<http://purl.org/spar/fabio/';
/** frbr: core relation vocabulary. */
export const FRBR = '<http://purl.org/vocab/frbr/core#';
/** prism: version and keyword vocabulary. */
export const PRISM = '<http://prismstandard.org/namespaces/basic/2.0/';
/** frapo: funding vocabulary. */
export const FRAPO = '<http://purl.org/spar/frapo/';
/** cito: citation vocabulary. */
export const CITO = '<http://purl.org/spar/cito/';
/** datacite: identifier vocabulary. */
export const DATACITE = '<http://purl.org/datacite/ontology/';
/** literal: typed value vocabulary. */
export const LITERAL = '<https://w3id.org/literal/';
/** skos: subject concept vocabulary. */
export const SKOS = '<http://www.w3.org/2004/02/skos/core#';
/** OpenDraft ontology namespace (ODM, ADR-021). */
export const OD = '<https://w3id.org/opendraft/ontology#';
/** CRediT contributor role namespace (NISO). */
export const CREDIT = '<https://credit.niso.org/contributor-roles/';
/** XML Schema datatype namespace. */
export const XSD = '<http://www.w3.org/2001/XMLSchema#';
/** ROR IRI namespace prefix without angle bracket. */
export const ROR_PREFIX = 'https://ror.org/';

/**
 * Escape a value as a Turtle string literal.
 *
 * @param value - Raw string value.
 * @returns The value wrapped in double quotes with escapes applied.
 */
export function literalString(value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    .replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  return `"${escaped}"`;
}

/**
 * Wrap an IRI in angle brackets.
 *
 * @param iri - Absolute IRI.
 * @returns The IRI as a Turtle IRI reference.
 */
export function termRef(iri: string): string {
  return `<${iri}>`;
}

/**
 * Format one Turtle subject with its predicate-object pairs.
 *
 * @param subject - Subject term, already an IRI reference or blank node.
 * @param pairs - Rendered predicate-object pair strings.
 * @returns The subject-predicate-object block terminated by a period.
 */
export function block(subject: string, pairs: string[]): string {
  return `${subject}\n    ${pairs.join(' ;\n    ')} .`;
}

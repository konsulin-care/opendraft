/**
 * Publication graph compiler implementing the FRBR Work/version model
 * (ADR-021): one fabio:Work with a concept DOI realized by a single
 * od:Publication version DOI, plus title, abstract, keywords, license,
 * a FRAPO grant from the funding statement, SKOS subject terms,
 * cito:cites reference DOIs and provenance scalars — composed around
 * the OCDM authorship graph.
 */
import { emitAuthorshipGraph } from './authorship-graph.js';
import { normalizeDoi } from './identifiers.js';
import type { NormalizedIdentifier } from './identifiers.js';
import type { AuthorObject, RegistryAffiliation } from '../types/author.js';

/** SKOS subject metadata from _frontmatter.yml. */
export interface PublicationSubject {
  /** Human-readable subject label (skos:prefLabel). */
  text: string;
  /** SKOS concept scheme URI; the term IRI is appended to it. */
  authority: string;
  /** Concept identifier within the scheme. */
  term: string;
}

/** Input for the publication graph compiler. */
export interface PublicationGraphInput {
  /** Article title (_frontmatter.yml). */
  title: string;
  /** Abstract text (_abstract.yml); omitted when absent. */
  abstract?: string;
  /** Keywords emitted as prism:keyword values. */
  keywords?: string[];
  /** License statement; known CC presets map to canonical URIs. */
  license?: string;
  /** Funding statement; becomes one frapo:Grant. */
  funding?: string;
  /** Subject term; becomes fabio:hasSubjectTerm plus dcterms:subject. */
  subject?: PublicationSubject;
  /** Authors in YAML order; their order becomes the oco:hasNext chain. */
  authors: AuthorObject[];
  /** Top-level affiliation registry resolving {ref} affiliation items. */
  affiliations?: RegistryAffiliation[];
  /** Repository URL provenance scalar (od:repositoryUrl). */
  repositoryUrl: string;
  /** Manuscript path provenance scalar (od:manuscriptPath). */
  manuscriptPath: string;
  /** 40-character Git commit SHA the manuscript was compiled from. */
  sourceRevision: string;
  /** 40-character Git commit SHA of the protocol revision used. */
  protocolRevision: string;
  /** Version DOI of this publication (publication IRI). */
  versionDoi: string;
  /** Concept DOI of the fabio:Work this publication realizes. */
  conceptDoi: string;
  /** Version DOI of the earlier version revised (frbr:revisionOf). */
  previousVersionDoi?: string;
  /** prism:versionIdentifier; defaults to 2 with a previous version, else 1. */
  versionNumber?: string;
  /** Reference DOIs cited via cito:cites. */
  references?: string[];
}

// Namespace constants include the opening angle bracket so that
// `${FABIO}Work>` expands to a wrapped Turtle IRI reference.
const OD = '<urn:opendraft:ontology#';
const DCTERMS = '<http://purl.org/dc/terms/';
const FABIO = '<http://purl.org/spar/fabio/';
const FRBR = '<http://purl.org/vocab/frbr/core#';
const PRISM = '<http://prismstandard.org/namespaces/basic/2.0/';
const FRAPO = '<http://purl.org/spar/frapo/';
const CITO = '<http://purl.org/spar/cito/';
const DATACITE = '<http://purl.org/datacite/ontology/';
const LITERAL = '<https://w3id.org/literal/';
const SKOS = '<http://www.w3.org/2004/02/skos/core#';
const XSD = '<http://www.w3.org/2001/XMLSchema#';

/** License presets mapped to their canonical deed URIs. */
const LICENSE_URIS: Record<string, string> = {
  'cc by 4.0': 'http://creativecommons.org/licenses/by/4.0/',
  'cc by-sa 4.0': 'http://creativecommons.org/licenses/by-sa/4.0/',
  'cc by-nc 4.0': 'http://creativecommons.org/licenses/by-nc/4.0/',
  cc0: 'http://creativecommons.org/publicdomain/zero/1.0/',
  'cc0 1.0': 'http://creativecommons.org/publicdomain/zero/1.0/',
};

/** Escape a value as a Turtle string literal. */
function literalString(value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    .replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  return `"${escaped}"`;
}

function termRef(iri: string): string {
  return `<${iri}>`;
}

function block(subject: string, pairs: string[]): string {
  return `${subject}\n    ${pairs.join(' ;\n    ')} .`;
}

/** Normalize a DOI or throw naming the offending input field. */
function requireDoi(input: string | undefined, label: string): NormalizedIdentifier {
  const doi = normalizeDoi(input);
  if (!doi) throw new Error(`compilePublicationGraph: invalid ${label} "${String(input)}"`);
  return doi;
}

/** Emit the inline OCDM datacite:hasIdentifier node for a DOI. */
function doiIdentifierNode(value: string): string {
  return (
    `[ ${DATACITE}usesIdentifierScheme> ${DATACITE}doi> ; ` +
    `${LITERAL}hasLiteralValue> ${literalString(value)} ]`
  );
}

/** Map a license statement to its canonical URI or keep it literal. */
function licenseObject(license: string): string {
  const uri = LICENSE_URIS[license.trim().toLowerCase()];
  return uri ? termRef(uri) : literalString(license);
}

/** Resolve the SKOS concept IRI for a subject assignment. */
function subjectTermIri(subject: PublicationSubject): string {
  const base = subject.authority.endsWith('/') || subject.authority.endsWith('#')
    ? subject.authority
    : `${subject.authority}/`;
  return `${base}${subject.term}`;
}

/** The Work block: concept DOI IRI typed as a named fabio:Work. */
function workBlock(conceptIri: string, title: string): string {
  return block(termRef(conceptIri), [
    `a ${FABIO}Work>`,
    `${DCTERMS}title> ${literalString(title)}`,
    `${DCTERMS}identifier> ${termRef(conceptIri)}`,
  ]);
}

/** The SKOS subject term block referenced by the publication. */
function subjectTermBlock(subject: PublicationSubject): string {
  return block(termRef(subjectTermIri(subject)), [
    `a ${SKOS}Concept> , ${FABIO}SubjectTerm>`,
    `${SKOS}prefLabel> ${literalString(subject.text)}@en`,
  ]);
}

/** The frapo:Grant block for the funding statement. */
function grantBlock(funding: string): string {
  return block('_:grant', [`a ${FRAPO}Grant>`, `${DCTERMS}title> ${literalString(funding)}`]);
}

/** Normalized, deduplicated reference DOIs in input order. */
function citedDois(references: string[] | undefined): string[] {
  const seen = new Set<string>();
  const iris: string[] = [];
  for (const ref of references ?? []) {
    const doi = normalizeDoi(ref);
    if (doi && !seen.has(doi.iri)) {
      seen.add(doi.iri);
      iris.push(doi.iri);
    }
  }
  return iris;
}

function versionNumber(input: PublicationGraphInput): string {
  if (typeof input.versionNumber === 'string' && input.versionNumber.length > 0) {
    return input.versionNumber;
  }
  return input.previousVersionDoi ? '2' : '1';
}

/** Every property pair of the od:Publication node in fixed order. */
function publicationPairs(
  input: PublicationGraphInput,
  versionDoi: NormalizedIdentifier,
  conceptDoi: NormalizedIdentifier,
): string[] {
  const pairs = [
    `a ${OD}Publication>`,
    `${DCTERMS}title> ${literalString(input.title)}`,
    `${DCTERMS}identifier> ${termRef(versionDoi.iri)}`,
    `${DATACITE}hasIdentifier> ${doiIdentifierNode(versionDoi.value)}`,
    `${OD}repositoryUrl> ${literalString(input.repositoryUrl)}^^${XSD}anyURI>`,
    `${OD}manuscriptPath> ${literalString(input.manuscriptPath)}`,
    `${OD}sourceRevision> ${literalString(input.sourceRevision)}`,
    `${OD}protocolRevision> ${literalString(input.protocolRevision)}`,
    `${FRBR}realizationOf> ${termRef(conceptDoi.iri)}`,
  ];
  if (input.previousVersionDoi) {
    const previous = normalizeDoi(input.previousVersionDoi);
    if (previous) pairs.push(`${FRBR}revisionOf> ${termRef(previous.iri)}`);
  }
  pairs.push(`${PRISM}versionIdentifier> ${literalString(versionNumber(input))}`);
  if (input.license) pairs.push(`${DCTERMS}license> ${licenseObject(input.license)}`);
  if (input.funding) pairs.push(`${FRAPO}isFundedBy> _:grant`);
  for (const doi of citedDois(input.references)) pairs.push(`${CITO}cites> ${termRef(doi)}`);
  if (input.abstract) pairs.push(`${DCTERMS}abstract> ${literalString(input.abstract)}`);
  if (input.keywords && input.keywords.length > 0) {
    const keywords = input.keywords.map(literalString).join(' ,\n                  ');
    pairs.push(`${PRISM}keyword> ${keywords}`);
  }
  if (input.subject) {
    const term = termRef(subjectTermIri(input.subject));
    pairs.push(`${FABIO}hasSubjectTerm> ${term}`);
    pairs.push(`${DCTERMS}subject> ${term}`);
  }
  return pairs;
}

/**
 * Compile the publication graph as deterministic Turtle.
 *
 * Emits the fabio:Work (concept DOI), the od:Publication (version DOI)
 * with provenance scalars, license, funding grant, keywords, subject
 * term and cito:cites references, plus the OCDM authorship graph in
 * YAML author order. The output is byte-identical across runs.
 *
 * @param input - Frontmatter, abstract, authors, affiliation registry,
 *   provenance scalars and concept/version DOIs.
 * @returns Self-contained Turtle using absolute IRIs only.
 * @throws {Error} When the version or concept DOI is not syntactically valid.
 */
export function compilePublicationGraph(input: PublicationGraphInput): string {
  const versionDoi = requireDoi(input.versionDoi, 'versionDoi');
  const conceptDoi = requireDoi(input.conceptDoi, 'conceptDoi');
  const blocks: string[] = [workBlock(conceptDoi.iri, input.title)];
  blocks.push(block(termRef(versionDoi.iri), publicationPairs(input, versionDoi, conceptDoi)));
  blocks.push(emitAuthorshipGraph({
    publication: versionDoi.iri,
    authors: input.authors,
    affiliations: input.affiliations,
  }).trimEnd());
  if (input.subject) blocks.push(subjectTermBlock(input.subject));
  if (input.funding) blocks.push(grantBlock(input.funding));
  return `${blocks.join('\n\n')}\n`;
}

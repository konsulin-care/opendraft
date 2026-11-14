import rdf from '@rdfjs/dataset';
import type { Term } from '@rdfjs/types';
import { validateShacl } from './shacl.js';
import type { ShaclValidationReport, TurtleDataset } from './types.js';

/** Profile of a manuscript RDF graph: pre-publication draft or published release. */
export type Profile = 'draft' | 'release';

/** Options for {@link validateWithProfile}: the two protocol shapes graphs. */
export interface ProfileValidationOptions {
  /** Base shapes graph (protocol/article.shacl.ttl); always applied. */
  base: TurtleDataset;
  /** Release-only shapes graph (protocol/article-release.shacl.ttl); applied to releases only. */
  release: TurtleDataset;
}

/** Result of profile-aware SHACL validation. */
export interface ProfileValidationResult {
  /** Profile detected from the data graph. */
  profile: Profile;
  /** Report produced against the shapes selected for the detected profile. */
  report: ShaclValidationReport;
}

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const OD_PUBLICATION = 'https://w3id.org/opendraft/ontology#Publication';

/**
 * Predicates that mark an od:Publication as a release: a DOI identifier
 * (classic dcterms:identifier or an OCDM datacite:hasIdentifier node)
 * or a frbr:realizationOf link to its fabio:Work.
 */
const RELEASE_MARKER_PREDICATES: ReadonlySet<string> = new Set([
  'http://purl.org/dc/terms/identifier',
  'http://purl.org/datacite/ontology/hasIdentifier',
  'http://purl.org/vocab/frbr/core#realizationOf',
]);

/**
 * Builds a stable comparison key for a term (term type plus value), so
 * blank-node and IRI subjects compare correctly across triples.
 *
 * @param term - RDF term to key.
 * @returns The `termType:value` key.
 */
function termKey(term: Term): string {
  return `${term.termType}:${term.value}`;
}

/**
 * Detects whether a dataset is a draft or a release.
 *
 * The graph is a release iff any subject typed od:Publication carries
 * dcterms:identifier, datacite:hasIdentifier or frbr:realizationOf;
 * otherwise it is a draft. A graph with no od:Publication is a draft.
 *
 * @param dataset - Parsed RDF graph of the manuscript.
 * @returns `'release'` when a publication carries a release marker, otherwise `'draft'`.
 */
export function detectProfile(dataset: TurtleDataset): Profile {
  const publications = new Set<string>();
  for (const quad of dataset) {
    if (quad.predicate.value === RDF_TYPE && quad.object.value === OD_PUBLICATION) {
      publications.add(termKey(quad.subject));
    }
  }
  if (publications.size === 0) {
    return 'draft';
  }
  for (const quad of dataset) {
    if (
      RELEASE_MARKER_PREDICATES.has(quad.predicate.value) &&
      publications.has(termKey(quad.subject))
    ) {
      return 'release';
    }
  }
  return 'draft';
}

/**
 * Merges two shapes graphs into one dataset for validation.
 *
 * @param first - First shapes graph.
 * @param second - Second shapes graph.
 * @returns A new dataset containing every quad of both inputs.
 */
function unionShapes(first: TurtleDataset, second: TurtleDataset): TurtleDataset {
  const merged = rdf.dataset();
  for (const quad of first) {
    merged.add(quad);
  }
  for (const quad of second) {
    merged.add(quad);
  }
  return merged;
}

/**
 * Runs SHACL validation with the shapes matching the graph's profile.
 *
 * Drafts are validated against the base shapes only; releases against
 * the base shapes plus the release-only shapes.
 *
 * @param data - Dataset containing the manuscript graph to validate.
 * @param options - Base and release shapes graphs.
 * @returns Resolves to the detected profile and the validation report.
 */
export async function validateWithProfile(
  data: TurtleDataset,
  options: ProfileValidationOptions,
): Promise<ProfileValidationResult> {
  const profile = detectProfile(data);
  const shapes =
    profile === 'release' ? unionShapes(options.base, options.release) : options.base;
  const report = await validateShacl(data, shapes);
  return { profile, report };
}

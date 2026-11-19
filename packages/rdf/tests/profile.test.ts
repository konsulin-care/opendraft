import { describe, expect, it } from 'vitest';
import { detectProfile, loadTurtle, parseTurtle, validateWithProfile } from '../src/index.js';
import type { ProfileValidationOptions } from '../src/index.js';
import type { ShaclValidationReport } from '../src/types.js';
import { fileURLToPath } from 'node:url';

// Repo-root paths, resolved from this file: suites run with cwd = packages/rdf.
const protocol = (path: string): string =>
  fileURLToPath(new URL(`../../../protocol/${path}`, import.meta.url));

const BASE_SHAPES = protocol('article.shacl.ttl');
const RELEASE_SHAPES = protocol('article-release.shacl.ttl');
const EXAMPLE_ARTICLE = protocol('examples/article.ttl');

/** A draft graph that conforms to the base shapes but carries no release marker. */
const DRAFT_TTL = `
  @prefix od: <https://w3id.org/opendraft/ontology#> .
  @prefix dcterms: <http://purl.org/dc/terms/> .
  @prefix pro: <http://purl.org/spar/pro/> .
  @prefix scoro: <http://purl.org/spar/scoro/> .
  @prefix foaf: <http://xmlns.com/foaf/0.1/> .
  @prefix ex: <https://example.org/> .

  ex:draft-pub
      a od:Publication ;
      dcterms:title "Draft manuscript" ;
      dcterms:creator ex:alice ;
      dcterms:license <http://creativecommons.org/licenses/by/4.0/> ;
      od:manuscriptPath "manuscripts/article.qmd" ;
      dcterms:conformsTo <https://github.com/konsulin-care/opendraft/tree/0000000000000000000000000000000000000000/protocol> ;
      pro:isDocumentContextFor ex:author-role , ex:affiliate-role .

  ex:author-role
      a pro:RoleInTime ;
      pro:withRole pro:author , scoro:corresponding-author ;
      pro:isHeldBy ex:alice .

  ex:affiliate-role
      a pro:RoleInTime ;
      pro:withRole scoro:affiliate ;
      pro:isHeldBy ex:alice ;
      pro:relatesToOrganization ex:org .

  ex:alice
      a foaf:Person ;
      foaf:givenName "Alice" ;
      foaf:familyName "Smith" ;
      foaf:mbox <mailto:alice@example.edu> .

  ex:org
      a foaf:Organization ;
      foaf:name "Example Organization" .
`;

/** The same draft graph with a DOI identifier, making it a release that still misses release-only fields. */
const RELEASE_MARKED_TTL = DRAFT_TTL.replace(
  'dcterms:creator ex:alice ;',
  'dcterms:creator ex:alice ;\n      dcterms:identifier <https://doi.org/10.5555/example-release-marked> ;',
);

/** A graph with every release marker but no title: release shapes pass, base shapes fail. */
const RELEASE_WITHOUT_TITLE_TTL = `
  @prefix od: <https://w3id.org/opendraft/ontology#> .
  @prefix dcterms: <http://purl.org/dc/terms/> .
  @prefix fabio: <http://purl.org/spar/fabio/> .
  @prefix frbr: <http://purl.org/vocab/frbr/core#> .
  @prefix ex: <https://example.org/> .
  @prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

  ex:release-work
      a fabio:Work ;
      dcterms:title "Untitled release work" .

  ex:release-pub
      a od:Publication ;
      dcterms:creator ex:alice ;
      dcterms:license <http://creativecommons.org/licenses/by/4.0/> ;
      dcterms:identifier <https://doi.org/10.5555/example-no-title> ;
      od:repositoryUrl "https://github.com/opendraft/opendraft"^^xsd:anyURI ;
      od:manuscriptPath "manuscripts/article.qmd" ;
      od:sourceRevision "1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d" ;
      dcterms:conformsTo <https://github.com/konsulin-care/opendraft/tree/0000000000000000000000000000000000000000/protocol> ;
      frbr:realizationOf ex:release-work .
`;

/** Collects every human-readable message of a report. */
const messages = (report: ShaclValidationReport): string[] =>
  report.results.flatMap((result) => result.message.map((m) => m.value));

/** A minimal graph whose od:Publication carries no release marker. */
const PROFILE_DRAFT_TTL = `
  @prefix od: <https://w3id.org/opendraft/ontology#> .
  @prefix dcterms: <http://purl.org/dc/terms/> .
  @prefix ex: <https://example.org/> .
  ex:pub a od:Publication ; dcterms:title "Draft" .
  ex:other dcterms:identifier <https://doi.org/10.5555/elsewhere> .
`;

/** The same graph with a DOI identifier on the publication itself. */
const PROFILE_DOI_TTL = `
  @prefix od: <https://w3id.org/opendraft/ontology#> .
  @prefix dcterms: <http://purl.org/dc/terms/> .
  @prefix ex: <https://example.org/> .
  ex:pub a od:Publication ;
    dcterms:identifier <https://doi.org/10.5555/example-release> .
`;

/** A publication carrying an OCDM datacite:hasIdentifier DOI node. */
const PROFILE_DATACITE_TTL = `
  @prefix od: <https://w3id.org/opendraft/ontology#> .
  @prefix datacite: <http://purl.org/datacite/ontology/> .
  @prefix literal: <https://w3id.org/literal/> .
  @prefix ex: <https://example.org/> .
  ex:pub a od:Publication ;
    datacite:hasIdentifier [
      datacite:usesIdentifierScheme datacite:doi ;
      literal:hasLiteralValue "10.5555/example-release" ;
    ] .
`;

/** A publication linked to its work via frbr:realizationOf. */
const PROFILE_REALIZATION_TTL = `
  @prefix od: <https://w3id.org/opendraft/ontology#> .
  @prefix frbr: <http://purl.org/vocab/frbr/core#> .
  @prefix ex: <https://example.org/> .
  ex:pub a od:Publication ; frbr:realizationOf ex:work .
`;

/** Loads the base and release shapes graphs from the protocol directory. */
const loadShapes = async (): Promise<ProfileValidationOptions> => {
  const [base, release] = await Promise.all([
    loadTurtle(BASE_SHAPES),
    loadTurtle(RELEASE_SHAPES),
  ]);
  return { base, release };
};

describe('detectProfile', () => {
  it("returns 'draft' for a publication with neither DOI identifier nor frbr:realizationOf", () => {
    expect(detectProfile(parseTurtle(PROFILE_DRAFT_TTL))).toBe('draft');
  });

  it("returns 'release' when a dcterms:identifier is present", () => {
    expect(detectProfile(parseTurtle(PROFILE_DOI_TTL))).toBe('release');
  });

  it("returns 'release' when a datacite:hasIdentifier node is present", () => {
    expect(detectProfile(parseTurtle(PROFILE_DATACITE_TTL))).toBe('release');
  });

  it("returns 'release' when frbr:realizationOf is present", () => {
    expect(detectProfile(parseTurtle(PROFILE_REALIZATION_TTL))).toBe('release');
  });
});

describe('validateWithProfile', () => {
  it('validates a draft against the base shapes only', async () => {
    const shapes = await loadShapes();
    const data = parseTurtle(DRAFT_TTL);

    const { profile, report } = await validateWithProfile(data, shapes);

    // The release shapes would reject this graph (no repository URL,
    // source revision, identifier or Work), so conforms=true proves
    // they were not applied to a draft.
    expect(profile).toBe('draft');
    expect(report.conforms).toBe(true);
    expect(report.results).toHaveLength(0);
  });

  it('validates a release against the base plus release shapes', async () => {
    const shapes = await loadShapes();
    const data = parseTurtle(RELEASE_MARKED_TTL);

    const { profile, report } = await validateWithProfile(data, shapes);

    expect(profile).toBe('release');
    expect(report.conforms).toBe(false);
    expect(messages(report)).toContain(
      'A release must have exactly one repository URL with datatype xsd:anyURI.',
    );
  });

  it('applies the base shapes to a release as well', async () => {
    const shapes = await loadShapes();
    const data = parseTurtle(RELEASE_WITHOUT_TITLE_TTL);

    const { profile, report } = await validateWithProfile(data, shapes);

    // Release-only shapes pass here, so only the base shape can fail.
    expect(profile).toBe('release');
    expect(report.conforms).toBe(false);
    expect(messages(report)).toContain('A publication must have exactly one title.');
  });

  it('accepts the canonical example article as a conforming release', async () => {
    const shapes = await loadShapes();
    const data = await loadTurtle(EXAMPLE_ARTICLE);

    const { profile, report } = await validateWithProfile(data, shapes);

    expect(profile).toBe('release');
    expect(report.conforms).toBe(true);
  });
});

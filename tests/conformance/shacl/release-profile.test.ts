/**
 * Release-profile SHACL conformance (behavior T26).
 *
 * protocol/article-release.shacl.ttl holds the release-only
 * constraints split out of protocol/article.shacl.ttl: the FRBR work
 * realization (frbr:realizationOf / frbr:revisionOf), the DOI
 * identifier requirement and the od:repositoryUrl / od:sourceRevision
 * provenance scalars. Asserts:
 * - a publication with title, creator, manuscriptPath and conformsTo
 *   but no DOI identifier, frbr:realizationOf, od:sourceRevision or
 *   od:repositoryUrl conforms to article.shacl.ttl alone
 * - the same publication violates article.shacl.ttl plus
 *   article-release.shacl.ttl
 */
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadTurtle, validateShacl } from '@opendraft/rdf';
import type { ShaclValidationReport, TurtleDataset } from '@opendraft/rdf';

// Repo-root protocol/, resolved from this file so cwd never matters.
const ARTICLE_SHAPES = fileURLToPath(new URL('../../../protocol/article.shacl.ttl', import.meta.url));
const RELEASE_SHAPES = fileURLToPath(new URL('../../../protocol/article-release.shacl.ttl', import.meta.url));
const SH_VIOLATION = 'http://www.w3.org/ns/shacl#Violation';
const FRBR = 'http://purl.org/vocab/frbr/core#';
const OD = 'https://w3id.org/opendraft/ontology#';

/**
 * A draft publication: title, creator, manuscriptPath, conformsTo and
 * a conforming authorship graph, but no DOI identifier,
 * frbr:realizationOf, od:sourceRevision or od:repositoryUrl.
 */
const DRAFT_TURTLE = `
@prefix od: <${OD}> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix pro: <http://purl.org/spar/pro/> .
@prefix scoro: <http://purl.org/spar/scoro/> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix ex: <https://example.org/> .

ex:draft-publication
    a od:Publication ;
    dcterms:title "A draft manuscript" ;
    dcterms:creator ex:alice ;
    dcterms:license <http://creativecommons.org/licenses/by/4.0/> ;
    od:manuscriptPath "manuscripts/draft/article.qmd" ;
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
    foaf:name "University of Indonesia" .
`;

let articleShapes: TurtleDataset;
let unionShapes: TurtleDataset;
let draftData: TurtleDataset;
let articleReport: ShaclValidationReport;
let unionReport: ShaclValidationReport;

/** Parse inline Turtle via a temp file. */
async function parseTurtle(text: string): Promise<TurtleDataset> {
  const dir = await mkdtemp(join(tmpdir(), 'release-profile-'));
  const file = join(dir, 'graph.ttl');
  await writeFile(file, text, 'utf8');
  return loadTurtle(file);
}

/**
 * True when a SHACL report contains at least one sh:Violation result.
 *
 * @param report - Report produced by validateShacl.
 * @returns True when at least one violation was reported.
 */
function hasViolation(report: ShaclValidationReport): boolean {
  return report.results.some((result) => result.severity.value === SH_VIOLATION);
}

/** Violation paths reported for the draft against the shape union. */
function violationPaths(report: ShaclValidationReport): (string | undefined)[] {
  return report.results
    .filter((result) => result.severity.value === SH_VIOLATION)
    .map((result) => result.path?.value);
}

/** Messages of every sh:Violation result in a report. */
function violationMessages(report: ShaclValidationReport): string[] {
  return report.results
    .filter((result) => result.severity.value === SH_VIOLATION)
    .flatMap((result) => result.message.map((m) => m.value));
}

beforeAll(async () => {
  articleShapes = await loadTurtle(ARTICLE_SHAPES);
  unionShapes = await loadTurtle(RELEASE_SHAPES);
  for (const quad of articleShapes) unionShapes.add(quad);
  draftData = await parseTurtle(DRAFT_TURTLE);
  articleReport = await validateShacl(draftData, articleShapes);
  unionReport = await validateShacl(draftData, unionShapes);
});

describe('release profile (T26)', () => {
  it('conforms to article.shacl.ttl alone', () => {
    expect(hasViolation(articleReport)).toBe(false);
    expect(articleReport.conforms).toBe(true);
  });

  it('violates article.shacl.ttl plus article-release.shacl.ttl', () => {
    expect(hasViolation(unionReport)).toBe(true);
    expect(unionReport.conforms).toBe(false);
    expect(violationPaths(unionReport)).toEqual(expect.arrayContaining([
      `${FRBR}realizationOf`,
      `${OD}repositoryUrl`,
      `${OD}sourceRevision`,
    ]));
  });
});

/**
 * A draft publication with title, manuscript path and conformsTo but no
 * dcterms:creator and no pro:isDocumentContextFor roles: the shape of a
 * project straight out of `opendraft init`, which has no authors yet.
 */
const NO_AUTHORSHIP_DRAFT_TURTLE = `
@prefix od: <${OD}> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix ex: <https://example.org/> .

ex:no-authors
    a od:Publication ;
    dcterms:title "A draft without authors" ;
    dcterms:license <http://creativecommons.org/licenses/by/4.0/> ;
    od:manuscriptPath "manuscripts/paper/article.qmd" ;
    dcterms:conformsTo <https://github.com/konsulin-care/opendraft/tree/0000000000000000000000000000000000000000/protocol> .
`;

/**
 * The same graph marked as a release by a DOI dcterms:identifier, so the
 * release shapes (including the authorship minimums) apply.
 */
const NO_AUTHORSHIP_RELEASE_TURTLE = `
@prefix od: <${OD}> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix ex: <https://example.org/> .

ex:no-authors
    a od:Publication ;
    dcterms:title "A draft without authors" ;
    dcterms:license <http://creativecommons.org/licenses/by/4.0/> ;
    dcterms:identifier "10.5281/zenodo.0000001" ;
    od:manuscriptPath "manuscripts/paper/article.qmd" ;
    dcterms:conformsTo <https://github.com/konsulin-care/opendraft/tree/0000000000000000000000000000000000000000/protocol> .
`;

describe('authorship minimums are release-only', () => {
  it('a draft without creators or author roles conforms to article.shacl.ttl alone', async () => {
    const data = await parseTurtle(NO_AUTHORSHIP_DRAFT_TURTLE);

    const report = await validateShacl(data, articleShapes);

    expect(violationPaths(report)).toEqual([]);
    expect(report.conforms).toBe(true);
  });

  it('the same graph as a release violates the union on creator and corresponding author', async () => {
    const data = await parseTurtle(NO_AUTHORSHIP_RELEASE_TURTLE);

    const report = await validateShacl(data, unionShapes);
    const messages = violationMessages(report);

    expect(messages).toContain('A publication must have at least one creator.');
    expect(messages).toContain(
      'A publication must have at least one corresponding-author role whose holder has a foaf:mbox.',
    );
  });
});

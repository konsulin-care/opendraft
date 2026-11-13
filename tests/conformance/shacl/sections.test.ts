/**
 * Section SHACL conformance (behavior T27).
 *
 * protocol/article.shacl.ttl gains od:SectionShape (doco:Section:
 * exactly one dcterms:title, at most one deo role class, an
 * oco:hasNext chain, an optional https dcterms:source) plus a
 * dcterms:hasPart sh:class doco:Section constraint on publications;
 * protocol/article-release.shacl.ttl gains od:SectionSourceShape
 * (releases require dcterms:source per section). Asserts:
 * - a release whose dcterms:hasPart sections are doco:Section nodes
 *   with one title, one deo role and an oco:hasNext chain conforms
 *   to article.shacl.ttl
 * - a section typed with two deo role classes, or one without
 *   dcterms:title, violates article.shacl.ttl
 * - a section without dcterms:source conforms to article.shacl.ttl
 *   but violates article-release.shacl.ttl
 */
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadTurtle, validateShacl } from '@opendraft/rdf';
import type { ShaclValidationReport, TurtleDataset } from '@opendraft/rdf';

const ROOT = new URL('../../../', import.meta.url);
const FIXTURES = new URL('tests/conformance/fixtures/', ROOT);
const ARTICLE_SHAPES = fileURLToPath(new URL('protocol/article.shacl.ttl', ROOT));
const RELEASE_SHAPES = fileURLToPath(new URL('protocol/article-release.shacl.ttl', ROOT));
const VALID_SECTIONS = fileURLToPath(new URL('valid/article-sections.ttl', FIXTURES));
const TWO_ROLES = fileURLToPath(new URL('invalid/article-section-two-roles.ttl', FIXTURES));
const NO_TITLE = fileURLToPath(new URL('invalid/article-section-no-title.ttl', FIXTURES));

const SH_VIOLATION = 'http://www.w3.org/ns/shacl#Violation';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const DCTERMS_TITLE = 'http://purl.org/dc/terms/title';
const DCTERMS_SOURCE = 'http://purl.org/dc/terms/source';
const TWO_ROLES_SECTION = 'https://example.org/two-roles-sec';
const NO_TITLE_SECTION = 'https://example.org/no-title-sec';

let articleShapes: TurtleDataset;
let unionShapes: TurtleDataset;
let validSections: TurtleDataset;
let twoRolesReport: ShaclValidationReport;
let noTitleReport: ShaclValidationReport;

/**
 * Violation results of a SHACL report; warnings and info results
 * never count as violations.
 *
 * @param report - Report produced by validateShacl.
 * @returns The sh:Violation result entries.
 */
function violations(report: ShaclValidationReport): ShaclValidationReport['results'] {
  return report.results.filter((result) => result.severity.value === SH_VIOLATION);
}

/**
 * A fresh copy of the valid release fixture with every
 * dcterms:source quad removed, so section-source behavior can be
 * asserted in isolation.
 *
 * @returns The stripped dataset plus how many source quads were removed.
 */
async function stripSectionSources(): Promise<{ data: TurtleDataset; removed: number }> {
  const data = await loadTurtle(VALID_SECTIONS);
  const sources = [...data].filter((quad) => quad.predicate.value === DCTERMS_SOURCE);
  for (const quad of sources) data.delete(quad);
  return { data, removed: sources.length };
}

beforeAll(async () => {
  articleShapes = await loadTurtle(ARTICLE_SHAPES);
  unionShapes = await loadTurtle(RELEASE_SHAPES);
  for (const quad of articleShapes) unionShapes.add(quad);
  validSections = await loadTurtle(VALID_SECTIONS);
  twoRolesReport = await validateShacl(await loadTurtle(TWO_ROLES), articleShapes);
  noTitleReport = await validateShacl(await loadTurtle(NO_TITLE), articleShapes);
});

describe('section shapes (T27)', () => {
  it('a publication with titled, single-role, chained hasPart sections conforms to article.shacl.ttl', async () => {
    const report = await validateShacl(validSections, articleShapes);
    expect(violations(report)).toEqual([]);
    expect(report.conforms).toBe(true);
    const releaseReport = await validateShacl(validSections, unionShapes);
    expect(violations(releaseReport)).toEqual([]);
    expect(releaseReport.conforms).toBe(true);
  });

  it('a section typed with two deo role classes violates article.shacl.ttl', () => {
    expect(twoRolesReport.conforms).toBe(false);
    expect(
      violations(twoRolesReport).some(
        (result) =>
          result.focusNode.value === TWO_ROLES_SECTION && result.path?.value === RDF_TYPE,
      ),
    ).toBe(true);
  });

  it('a section without dcterms:title violates article.shacl.ttl', () => {
    expect(noTitleReport.conforms).toBe(false);
    expect(
      violations(noTitleReport).some(
        (result) =>
          result.focusNode.value === NO_TITLE_SECTION && result.path?.value === DCTERMS_TITLE,
      ),
    ).toBe(true);
  });

  it('a section without dcterms:source conforms to article.shacl.ttl but violates article-release.shacl.ttl', async () => {
    const { data, removed } = await stripSectionSources();
    expect(removed).toBeGreaterThan(0);
    const articleReport = await validateShacl(data, articleShapes);
    expect(articleReport.conforms).toBe(true);
    const releaseReport = await validateShacl(data, unionShapes);
    expect(releaseReport.conforms).toBe(false);
    const sourceViolations = violations(releaseReport).filter(
      (result) => result.path?.value === DCTERMS_SOURCE,
    );
    expect(sourceViolations.length).toBe(removed);
  });
});

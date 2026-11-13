#!/usr/bin/env node
/**
 * SHACL conformance runner — validates all protocol fixtures.
 *
 * Exits 0 iff every valid fixture conforms and every invalid fixture
 * fails, with no unexpected results. Prints per-fixture status.
 * Only sh:Violation results count as failures; sh:Warning and sh:Info
 * results do not affect conformance.
 *
 * Draft vs release (T26): a graph is a release iff its od:Publication
 * carries a DOI identifier (dcterms:identifier or
 * datacite:hasIdentifier) or realizes a fabio:Work via
 * frbr:realizationOf. Release fixtures validate against the union of
 * protocol/article.shacl.ttl and protocol/article-release.shacl.ttl;
 * drafts validate against article.shacl.ttl alone.
 *
 * Valid fixtures: protocol/examples/*.ttl, protocol/registry.ttl and
 * tests/conformance/fixtures/valid/*.ttl (must-conform edge cases).
 * Invalid fixtures: tests/conformance/fixtures/invalid/*.ttl
 *
 * Usage: tsx tests/conformance/shacl/run-conformance.ts
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadTurtle, validateShacl } from '@opendraft/rdf';
import type { ShaclValidationReport, TurtleDataset } from '@opendraft/rdf';

const ARTICLE_SHAPES = 'protocol/article.shacl.ttl';
const RELEASE_SHAPES = 'protocol/article-release.shacl.ttl';
const REGISTRY_SHAPES = 'protocol/registry.shacl.ttl';
const VALID_DIRS = ['protocol/examples', 'tests/conformance/fixtures/valid'];
const VALID_FILES = ['protocol/registry.ttl'];
const INVALID_DIR = 'tests/conformance/fixtures/invalid';
const SH_VIOLATION = 'http://www.w3.org/ns/shacl#Violation';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const OD_PUBLICATION = 'https://w3id.org/opendraft/ontology#Publication';
/** Predicates whose presence on an od:Publication marks a release graph. */
const RELEASE_PREDICATES = new Set([
  'http://purl.org/dc/terms/identifier',
  'http://purl.org/datacite/ontology/hasIdentifier',
  'http://purl.org/vocab/frbr/core#realizationOf',
]);

let failures = 0;
let checks = 0;

/**
 * True when a SHACL report contains at least one sh:Violation result.
 * Warnings and info results never count as failures.
 *
 * @param report - Report produced by validateShacl.
 * @returns True when at least one violation was reported.
 */
function hasViolation(report: ShaclValidationReport): boolean {
  return report.results.some((result) => result.severity.value === SH_VIOLATION);
}

/**
 * Classify a data graph as release or draft: a graph is a release iff
 * its od:Publication carries a DOI identifier (dcterms:identifier or
 * datacite:hasIdentifier) or realizes a Work (frbr:realizationOf).
 *
 * @param data - Parsed fixture graph.
 * @returns True for the release profile, false for the draft profile.
 */
function isRelease(data: TurtleDataset): boolean {
  const publications = new Set<string>();
  for (const quad of data) {
    if (quad.predicate.value === RDF_TYPE && quad.object.value === OD_PUBLICATION) {
      publications.add(quad.subject.value);
    }
  }
  for (const quad of data) {
    if (publications.has(quad.subject.value) && RELEASE_PREDICATES.has(quad.predicate.value)) {
      return true;
    }
  }
  return false;
}

function fail(message: string): void {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

function check(expectConform: boolean, actual: boolean, label: string): void {
  checks += 1;
  if (actual === expectConform) {
    console.log(`PASS: ${label} (${actual ? 'conforms' : 'fails as expected'})`);
  } else {
    fail(`${label}: expected ${expectConform ? 'conform' : 'non-conform'}, got ${actual}`);
  }
}

async function listTtl(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  return entries.filter((name) => name.endsWith('.ttl')).map((name) => join(dir, name));
}

/**
 * The article shape graph for a fixture's profile: the article+release
 * union for releases, article.shacl.ttl alone for drafts.
 *
 * @param data - Parsed fixture graph.
 * @param articleShapes - Shapes from protocol/article.shacl.ttl.
 * @param releaseShapes - Union of article and release shapes.
 * @returns Shapes dataset to validate the fixture against.
 */
function shapesFor(data: TurtleDataset, articleShapes: TurtleDataset, releaseShapes: TurtleDataset): TurtleDataset {
  return isRelease(data) ? releaseShapes : articleShapes;
}

async function main(): Promise<void> {
  const articleShapes = await loadTurtle(ARTICLE_SHAPES);
  const releaseShapes = await loadTurtle(RELEASE_SHAPES);
  for (const quad of articleShapes) releaseShapes.add(quad);
  const registryShapes = await loadTurtle(REGISTRY_SHAPES);

  // Valid fixtures: article examples validate against the profile
  // shapes (release union or draft-only); registry examples also
  // validate against registry shapes.
  const validFiles = [...VALID_FILES];
  for (const dir of VALID_DIRS) {
    validFiles.push(...(await listTtl(dir)));
  }
  for (const file of validFiles) {
    const data = await loadTurtle(file);
    const release = isRelease(data);
    const report = await validateShacl(data, shapesFor(data, articleShapes, releaseShapes));
    check(true, !hasViolation(report), `${file} (${release ? 'article+release shapes' : 'article shapes'})`);
    const registryReport = await validateShacl(data, registryShapes);
    check(true, !hasViolation(registryReport), `${file} (registry shapes)`);
  }

  // Invalid fixtures must fail against the relevant shapes.
  const invalidFiles = await listTtl(INVALID_DIR);
  for (const file of invalidFiles) {
    const data = await loadTurtle(file);
    const release = isRelease(data);
    const articleReport = await validateShacl(data, shapesFor(data, articleShapes, releaseShapes));
    const registryReport = await validateShacl(data, registryShapes);
    // An invalid fixture must produce at least one violation in some
    // shape graph; warnings and info results do not count.
    if (!hasViolation(articleReport) && !hasViolation(registryReport)) {
      fail(`${file} conforms to the ${release ? 'release' : 'draft'} article profile and registry shapes (expected failure)`);
    } else {
      console.log(`PASS: ${file} fails validation as expected`);
    }
    checks += 1;
  }

  console.log(`\nConformance: ${checks - failures}/${checks} passed`);
  if (failures > 0) {
    process.exitCode = 1;
  }
}

await main();

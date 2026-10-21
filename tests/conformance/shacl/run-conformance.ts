#!/usr/bin/env node
/**
 * SHACL conformance runner — validates all protocol fixtures.
 *
 * Exits 0 iff every valid fixture conforms and every invalid fixture
 * fails, with no unexpected results. Prints per-fixture status.
 * Only sh:Violation results count as failures; sh:Warning and sh:Info
 * results do not affect conformance.
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
import type { ShaclValidationReport } from '@opendraft/rdf';

const ARTICLE_SHAPES = 'protocol/article.shacl.ttl';
const REGISTRY_SHAPES = 'protocol/registry.shacl.ttl';
const VALID_DIRS = ['protocol/examples', 'tests/conformance/fixtures/valid'];
const VALID_FILES = ['protocol/registry.ttl'];
const INVALID_DIR = 'tests/conformance/fixtures/invalid';
const SH_VIOLATION = 'http://www.w3.org/ns/shacl#Violation';

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

async function main(): Promise<void> {
  const articleShapes = await loadTurtle(ARTICLE_SHAPES);
  const registryShapes = await loadTurtle(REGISTRY_SHAPES);

  // Valid fixtures: article examples validate against article shapes;
  // registry examples validate against registry shapes.
  const validFiles = [...VALID_FILES];
  for (const dir of VALID_DIRS) {
    validFiles.push(...(await listTtl(dir)));
  }
  for (const file of validFiles) {
    const data = await loadTurtle(file);
    const report = await validateShacl(data, articleShapes);
    check(true, !hasViolation(report), `${file} (article shapes)`);
    const registryReport = await validateShacl(data, registryShapes);
    check(true, !hasViolation(registryReport), `${file} (registry shapes)`);
  }

  // Invalid fixtures must fail against the relevant shapes.
  const invalidFiles = await listTtl(INVALID_DIR);
  for (const file of invalidFiles) {
    const data = await loadTurtle(file);
    const articleReport = await validateShacl(data, articleShapes);
    const registryReport = await validateShacl(data, registryShapes);
    // An invalid fixture must produce at least one violation in some
    // shape graph; warnings and info results do not count.
    if (!hasViolation(articleReport) && !hasViolation(registryReport)) {
      failures += 1;
      console.error(`FAIL: ${file} conforms to both article and registry shapes (expected failure)`);
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

/**
 * Registry SHACL conformance (behavior T21).
 *
 * Loads protocol/registry.shacl.ttl (fabio:ExpressionCollection with
 * sh:xone over frbr:part) and asserts:
 * - protocol/registry.ttl conforms (frbr:part holds only collections)
 * - protocol/examples/publication-registry.ttl conforms (frbr:part
 *   holds only publications)
 * - tests/conformance/fixtures/invalid/registry-mixed-types.ttl
 *   violates the shapes (frbr:part mixes both kinds)
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { loadTurtle, validateShacl } from '@opendraft/rdf';
import type { ShaclValidationReport, TurtleDataset } from '@opendraft/rdf';

const REGISTRY_SHAPES = 'protocol/registry.shacl.ttl';
const COLLECTION_REGISTRY = 'protocol/registry.ttl';
const PUBLICATION_REGISTRY = 'protocol/examples/publication-registry.ttl';
const MIXED_REGISTRY = 'tests/conformance/fixtures/invalid/registry-mixed-types.ttl';
const MIXED_REGISTRY_IRI = 'https://example.org/mixed-registry';
const SH_VIOLATION = 'http://www.w3.org/ns/shacl#Violation';

let shapes: TurtleDataset;

/**
 * True when a SHACL report contains at least one sh:Violation result.
 *
 * @param report - Report produced by validateShacl.
 * @returns True when at least one violation was reported.
 */
function hasViolation(report: ShaclValidationReport): boolean {
  return report.results.some((result) => result.severity.value === SH_VIOLATION);
}

/**
 * Validates a Turtle data file against the registry shapes.
 *
 * @param path - Repo-root-relative path of the data file.
 * @returns Resolves to the SHACL validation report.
 */
async function validateRegistry(path: string): Promise<ShaclValidationReport> {
  return validateShacl(await loadTurtle(path), shapes);
}

beforeAll(async () => {
  shapes = await loadTurtle(REGISTRY_SHAPES);
});

describe('protocol/registry.shacl.ttl', () => {
  it('accepts the collection registry example (protocol/registry.ttl)', async () => {
    const report = await validateRegistry(COLLECTION_REGISTRY);
    expect(hasViolation(report)).toBe(false);
    expect(report.conforms).toBe(true);
  });

  it('accepts the publication registry example (protocol/examples/publication-registry.ttl)', async () => {
    const report = await validateRegistry(PUBLICATION_REGISTRY);
    expect(hasViolation(report)).toBe(false);
    expect(report.conforms).toBe(true);
  });

  it('rejects registry-mixed-types.ttl (frbr:part mixes a publication and a collection)', async () => {
    const report = await validateRegistry(MIXED_REGISTRY);
    expect(hasViolation(report)).toBe(true);
    expect(report.conforms).toBe(false);
    expect(
      report.results.some(
        (result) =>
          result.severity.value === SH_VIOLATION &&
          result.focusNode.value === MIXED_REGISTRY_IRI,
      ),
    ).toBe(true);
  });
});

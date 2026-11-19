import SHACLValidator from 'rdf-validate-shacl';
import { parseTurtle } from './parse.js';
import type { ShaclValidationReport, ShaclValidationResult, TurtleDataset } from './types.js';

/**
 * Parses a Turtle (.ttl) file into an RDF/JS DatasetCore.
 *
 * The filesystem read is loaded through a dynamic import so this module keeps
 * no static `node:` imports and stays browser-safe.
 *
 * @param path - Filesystem path to the Turtle file.
 * @returns Resolves to a dataset containing every quad in the file.
 * @throws When the file cannot be read or parsed as Turtle.
 */
export async function loadTurtle(path: string): Promise<TurtleDataset> {
  const { readFile } = await import('node:fs/promises');
  const content = await readFile(path, 'utf8');
  return parseTurtle(content);
}

/**
 * Runs SHACL validation of a data graph against a shapes graph.
 *
 * @param data - Dataset containing the data to validate.
 * @param shapes - Dataset containing the SHACL shape definitions.
 * @returns Resolves to `{ conforms, results }` describing conformance.
 */
export async function validateShacl(
  data: TurtleDataset,
  shapes: TurtleDataset,
): Promise<ShaclValidationReport> {
  const validator = new SHACLValidator(shapes);
  const report = await validator.validate(data);
  const results: ShaclValidationResult[] = report.results.map((result) => ({
    focusNode: result.focusNode,
    path: result.path,
    value: result.value,
    message: result.message,
    severity: result.severity,
    sourceConstraintComponent: result.sourceConstraintComponent,
    sourceShape: result.sourceShape,
  }));

  return { conforms: report.conforms, results };
}

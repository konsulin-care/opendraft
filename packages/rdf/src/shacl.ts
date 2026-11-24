import SHACLValidator from 'rdf-validate-shacl';
import type { ShaclValidationReport, ShaclValidationResult, TurtleDataset } from './types.js';

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

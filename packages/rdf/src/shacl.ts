import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import rdf from '@rdfjs/dataset';
import ParserN3 from '@rdfjs/parser-n3';
import SHACLValidator from 'rdf-validate-shacl';
import type { Quad } from '@rdfjs/types';
import type { ShaclValidationReport, ShaclValidationResult, TurtleDataset } from './types.js';

const parser = new ParserN3();

/**
 * Parses a Turtle (.ttl) file into an RDF/JS DatasetCore.
 *
 * @param path - Filesystem path to the Turtle file.
 * @returns Resolves to a dataset containing every quad in the file.
 * @throws When the file cannot be read or parsed as Turtle.
 */
export async function loadTurtle(path: string): Promise<TurtleDataset> {
  const content = await readFile(path, 'utf8');
  const input = Readable.from([content]);
  const quads: Quad[] = [];

  const output = parser.import(input) as unknown as AsyncIterable<Quad>;
  for await (const quad of output) {
    quads.push(quad);
  }

  return rdf.dataset(quads);
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
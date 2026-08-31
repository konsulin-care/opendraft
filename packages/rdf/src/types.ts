import type { DatasetCore, Term } from '@rdfjs/types';

/**
 * A single SHACL validation result entry, mirroring the shape defined by
 * the W3C SHACL Validation Report structure.
 */
export interface ShaclValidationResult {
  /** Focus node of the validation. */
  focusNode: Term;
  /** Constraint path that failed. */
  path: Term | undefined;
  /** Value that violated the constraint, if any. */
  value: Term | undefined;
  /** Human-readable constraint messages. */
  message: Term[];
  /** Severity term (sh:Info, sh:Warning, sh:Violation). */
  severity: Term;
  /** Constraint component that produced the result. */
  sourceConstraintComponent: Term | undefined;
  /** Shape that produced the result. */
  sourceShape: Term | undefined;
}

/**
 * Result of running SHACL validation over a data graph.
 */
export interface ShaclValidationReport {
  /** True when the data graph conforms to all shapes. */
  conforms: boolean;
  /** Individual validation results; empty when conforms is true. */
  results: ShaclValidationResult[];
}

/**
 * An RDF/JS dataset parsed from a Turtle file.
 */
export type TurtleDataset = DatasetCore;
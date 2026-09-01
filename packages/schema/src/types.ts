/**
 * A single validation error entry.
 */
export interface ValidationError {
  /** JSON path to the failing value, e.g. "protocol.version". */
  path: string;
  /** Human-readable error description. */
  message: string;
}

/**
 * Result of running a schema or convention validator.
 */
export interface ValidationResult {
  /** True when all checks pass. */
  valid: boolean;
  /** Individual errors; empty when valid is true. */
  errors: ValidationError[];
}

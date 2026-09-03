import AjvModule from 'ajv';

// TS 6 (NodeNext) types the CJS default import as the module namespace,
// while Node ESM interop and Vite both provide the constructable class.
const Ajv = AjvModule as unknown as typeof import('ajv').default;
import type { ValidationResult, ValidationError } from './types.js';
import opendraftSchema from '../schemas/opendraft.schema.json' with { type: 'json' };

interface AjvError {
  instancePath: string;
  keyword: string;
  params: Record<string, string>;
  message?: string;
}

const ajv = new Ajv({ allErrors: true, verbose: true });
const validate = ajv.compile(opendraftSchema);

/**
 * Map AJV error objects to our ValidationError format.
 */
function mapErrors(errors: AjvError[] | undefined | null): ValidationError[] {
  if (!errors) return [];
  return errors.map((err) => {
    let path = err.instancePath.replace(/^\//, '').replace(/\//g, '.');
    // For 'required' errors, append the missing property name.
    if (err.keyword === 'required' && err.params.missingProperty) {
      path = path ? `${path}.${err.params.missingProperty}` : err.params.missingProperty;
    }
    return {
      path: path || 'root',
      message: err.message ?? 'unknown error',
    };
  });
}

/**
 * Validate an opendraft.yml configuration object against the schema.
 *
 * @param config - Parsed YAML content from opendraft.yml.
 * @returns ValidationResult with valid flag and any errors.
 */
export function validateOpendraft(config: unknown): ValidationResult {
  const valid = validate(config) as boolean;
  return {
    valid,
    errors: mapErrors(validate.errors as unknown as AjvError[]),
  };
}

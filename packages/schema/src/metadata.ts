import { createRequire } from 'node:module';
import type { ValidationResult, ValidationError } from './types.js';
import authorSchema from '../schemas/author.schema.json' with { type: 'json' };
import abstractSchema from '../schemas/abstract.schema.json' with { type: 'json' };
import frontmatterSchema from '../schemas/frontmatter.schema.json' with { type: 'json' };

const require = createRequire(import.meta.url);
const Ajv = require('ajv') as typeof import('ajv').default;

interface AjvError {
  instancePath: string;
  keyword: string;
  params: Record<string, string>;
  message?: string;
}

const ajv = new Ajv({ allErrors: true, verbose: true });

const schemas = {
  author: ajv.compile(authorSchema),
  abstract: ajv.compile(abstractSchema),
  frontmatter: ajv.compile(frontmatterSchema),
} as const;

/**
 * Map AJV error objects to our ValidationError format.
 */
function mapErrors(errors: AjvError[] | undefined | null): ValidationError[] {
  if (!errors) return [];
  return errors.map((err) => {
    let path = err.instancePath.replace(/^\//, '').replace(/\//g, '.');
    if (err.keyword === 'required' && err.params.missingProperty) {
      path = path ? `${path}.${err.params.missingProperty}` : err.params.missingProperty;
    }
    return {
      path: path || 'root',
      message: err.message ?? 'unknown error',
    };
  });
}

/** Metadata file types supported by the validator. */
export type MetadataType = 'author' | 'abstract' | 'frontmatter';

/**
 * Validate a parsed metadata file against its schema.
 *
 * @param data - Parsed YAML content.
 * @param type - Which metadata file type to validate against.
 * @returns ValidationResult with valid flag and any errors.
 */
export function validateMetadata(data: unknown, type: MetadataType): ValidationResult {
  const validate = schemas[type];
  const valid = validate(data) as boolean;
  return {
    valid,
    errors: mapErrors(validate.errors as unknown as AjvError[]),
  };
}

import type { ValidationResult, ValidationError } from './types.js';

/** Manuscript identifier pattern: lowercase alphanumeric + hyphens. */
const MANUSCRIPT_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Required files in a manuscript directory. */
const REQUIRED_FILES = [
  'article.qmd',
  '_author.yml',
  '_abstract.yml',
  '_frontmatter.yml',
  'references.bib',
];

/**
 * Validate a manuscript directory structure.
 *
 * @param id - Manuscript identifier (directory name).
 * @param files - List of filenames in the manuscript directory.
 * @returns ValidationResult with valid flag and any errors.
 */
export function validateManuscript(id: string, files: string[]): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate identifier
  if (!id || !MANUSCRIPT_ID_PATTERN.test(id)) {
    errors.push({
      path: 'id',
      message: `Invalid manuscript identifier "${id}". Must match ${MANUSCRIPT_ID_PATTERN}.`,
    });
  }

  // Validate required files
  for (const required of REQUIRED_FILES) {
    if (!files.includes(required)) {
      errors.push({
        path: `files[${required}]`,
        message: `Missing required file "${required}".`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

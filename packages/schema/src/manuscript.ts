import type { ValidationResult, ValidationError } from './types.js';
import { MANUSCRIPT_ID_PATTERN } from './naming.js';

/**
 * Files every manuscript directory must contain, regardless of layout.
 *
 * ADR-020 layout: `article.qmd` is always required; `blocks/manifest.json`
 * no longer signals a relaxed layout.
 */
const REQUIRED_FILES = [
  'article.qmd',
  '_author.yml',
  '_abstract.yml',
  '_frontmatter.yml',
];

/**
 * Validate a manuscript directory structure.
 *
 * ADR-020: the four required files are enforced whether or not
 * `blocks/manifest.json` is listed; there is no layout detection.
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

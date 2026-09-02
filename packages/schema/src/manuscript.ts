import type { ValidationResult, ValidationError } from './types.js';

/** Manuscript identifier pattern: lowercase alphanumeric + hyphens. */
const MANUSCRIPT_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Required files in a legacy manuscript directory. */
const LEGACY_REQUIRED_FILES = [
  'article.qmd',
  '_author.yml',
  '_abstract.yml',
  '_frontmatter.yml',
  'references.bib',
];

/** Required files in a block-based manuscript directory (besides blocks/). */
const BLOCK_REQUIRED_FILES = [
  '_author.yml',
  '_abstract.yml',
  '_frontmatter.yml',
  'references.bib',
];

/** Signal file for block-based layout. */
const BLOCK_MANIFEST = 'blocks/manifest.json';

/**
 * Validate a manuscript directory structure.
 *
 * Accepts both legacy five-file layout and block-based layout.
 * Presence of `blocks/manifest.json` signals block layout.
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

  const isBlockLayout = files.includes(BLOCK_MANIFEST);

  if (isBlockLayout) {
    // Block-based layout: article.qmd is derived, not required
    for (const required of BLOCK_REQUIRED_FILES) {
      if (!files.includes(required)) {
        errors.push({
          path: `files[${required}]`,
          message: `Missing required file "${required}".`,
        });
      }
    }
  } else {
    // Legacy layout: all five files required
    for (const required of LEGACY_REQUIRED_FILES) {
      if (!files.includes(required)) {
        errors.push({
          path: `files[${required}]`,
          message: `Missing required file "${required}".`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

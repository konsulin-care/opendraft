/**
 * Manuscript id normalization and validation.
 *
 * Ids are lowercase kebab-case: runs of characters outside `[a-z0-9]`
 * collapse to a single hyphen, edge hyphens are trimmed, and an empty
 * result falls back to `manuscript`. Validation uses the shared
 * `MANUSCRIPT_ID_PATTERN` from `@opendraft/schema`.
 */
import { MANUSCRIPT_ID_PATTERN } from '@opendraft/schema';

/**
 * Normalize a human-readable name into a manuscript id.
 *
 * Lowercases the input, replaces every run of characters outside
 * `[a-z0-9]` with a single hyphen, and trims leading/trailing hyphens.
 *
 * @param name - Raw project, folder, or repository name.
 * @returns A lowercase kebab-case id; `'manuscript'` when normalization
 *          yields an empty string.
 */
export function normalizeManuscriptId(name: string): string {
  const id = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return id === '' ? 'manuscript' : id;
}

/**
 * Check whether a string is a valid manuscript id.
 *
 * @param id - Candidate id to validate.
 * @returns True when the id matches `MANUSCRIPT_ID_PATTERN`.
 */
export function isValidManuscriptId(id: string): boolean {
  return MANUSCRIPT_ID_PATTERN.test(id);
}

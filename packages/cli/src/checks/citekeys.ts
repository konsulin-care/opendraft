/**
 * Citekey validation against the bibliography named in a container article.
 *
 * Resolves the `bibliography` entry from article.qmd front matter (the
 * shared `manuscripts/references.bib` in scaffolded projects), parses it
 * with the references package, and reports every citekey used in a block
 * file that the bibliography does not define. A malformed bibliography
 * yields a single parse-error finding instead of per-key findings. A
 * missing front matter entry or unreadable bibliography skips the check.
 */

import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
// Relative import: @opendraft/validate exposes only its index (not editable by this task).
import { bibliographyRef, checkCitekeysAgainst } from '../../../validate/src/citekeys.js';
import type { CitekeyFinding } from '../../../validate/src/citekeys.js';

export type { CitekeyFinding };

/**
 * Read a file as UTF-8 text.
 *
 * @param path - Absolute file path.
 * @returns File contents, or null when the file cannot be read.
 */
function readText(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Check block citekeys against the bibliography named in article.qmd.
 *
 * Parses the resolved bibliography once: a parse failure produces a single
 * error naming the bibliography file; otherwise every citekey extracted
 * from a block file that the bibliography does not define produces an
 * error naming the block file and the key.
 *
 * @param root - Project root directory.
 * @param manuscriptPath - Project-relative manuscript directory used for
 *                         finding locations.
 * @param assembly - Container article text naming the bibliography.
 * @param blockFiles - Block contents keyed by `blocks/<file>`.
 * @returns Error findings: one per unknown citekey, or one parse failure;
 *          empty when the bibliography is absent, unreadable, or all keys resolve.
 */
export function checkCitekeys(
  root: string,
  manuscriptPath: string,
  assembly: string,
  blockFiles: Record<string, string>,
): CitekeyFinding[] {
  const ref = bibliographyRef(assembly);
  if (ref === null) return [];
  const bibPath = resolve(root, manuscriptPath, ref);
  const text = readText(bibPath);
  if (text === null) return [];
  const location = relative(root, bibPath);
  return checkCitekeysAgainst(text, location, manuscriptPath, blockFiles);
}

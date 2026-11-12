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
import { extractCitekeys } from '@opendraft/manuscript';
import { parseBibTeX } from '@opendraft/references';
import { parse as parseYaml } from 'yaml';

/** One citekey finding: always an error, with its project-relative location. */
export interface CitekeyFinding {
  level: 'error';
  location: string;
  message: string;
}

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
 * Extract the bibliography path from an article's YAML front matter.
 *
 * @param article - Container article text.
 * @returns First `bibliography` entry (string or array), or null when the
 *          front matter is absent, unparseable, or names no bibliography.
 */
function bibliographyRef(article: string): string | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(article);
  if (match === null) return null;
  let data: unknown;
  try {
    data = parseYaml(match[1]);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const bib = (data as { bibliography?: unknown }).bibliography;
  if (typeof bib === 'string') return bib;
  if (Array.isArray(bib)) {
    for (const item of bib) {
      if (typeof item === 'string') return item;
    }
  }
  return null;
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
  const findings: CitekeyFinding[] = [];
  const ref = bibliographyRef(assembly);
  if (ref === null) return findings;
  const bibPath = resolve(root, manuscriptPath, ref);
  const text = readText(bibPath);
  if (text === null) return findings;
  const location = relative(root, bibPath);
  let known: Set<string>;
  try {
    known = new Set(parseBibTeX(text).map((entry) => entry.citeKey));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    findings.push({ level: 'error', location, message: `Failed to parse bibliography: ${message}` });
    return findings;
  }
  for (const [path, content] of Object.entries(blockFiles)) {
    for (const key of extractCitekeys(content)) {
      if (known.has(key)) continue;
      findings.push({
        level: 'error',
        location: `${manuscriptPath}/${path}`,
        message: `unknown citekey ${key}: not found in ${location}`,
      });
    }
  }
  return findings;
}

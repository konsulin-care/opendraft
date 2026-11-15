/**
 * Citekey validation against the bibliography named in a container article.
 *
 * Resolves the `bibliography` entry from article.qmd front matter, parses it
 * with the references package, and reports every citekey used in a block
 * file that the bibliography does not define. A malformed bibliography
 * yields a single parse-error finding. A missing entry or unreadable
 * bibliography skips the check.
 */

import { extractCitekeys } from '@opendraft/manuscript';
import { parseBibTeX } from '@opendraft/references';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { parse as parseYaml } from 'yaml';

/** One citekey finding: always an error, with its project-relative location. */
export interface CitekeyFinding {
  level: 'error';
  location: string;
  message: string;
}

/**
 * Extract the bibliography path from an article's YAML front matter.
 *
 * @param article - Container article text.
 * @returns First `bibliography` entry, or null when absent or unparseable.
 */
export function bibliographyRef(article: string): string | null {
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
 * Normalize a POSIX path, resolving `.` and `..` segments.
 *
 * @param path - Slash-separated relative path.
 * @returns Normalized path.
 */
function normalizePath(path: string): string {
  const out: string[] = [];
  for (const seg of path.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return out.join('/');
}

/**
 * Compare block citekeys with bibliography text (pure, no I/O).
 *
 * @param bibText - Bibliography contents.
 * @param location - Project-relative bibliography path for messages.
 * @param manuscriptPath - Manuscript directory used for block locations.
 * @param blockFiles - Block contents keyed by `blocks/<file>`.
 * @returns Error findings; one parse failure or one per unknown key.
 */
export function checkCitekeysAgainst(
  bibText: string,
  location: string,
  manuscriptPath: string,
  blockFiles: Record<string, string>,
): CitekeyFinding[] {
  let known: Set<string>;
  try {
    known = new Set(parseBibTeX(bibText).map((entry) => entry.citeKey));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return [{ level: 'error', location, message: `Failed to parse bibliography: ${message}` }];
  }
  const findings: CitekeyFinding[] = [];
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

/**
 * Check block citekeys against the bibliography named in article.qmd.
 *
 * @param ws - Workspace adapter rooted at the project.
 * @param manuscriptPath - Project-relative manuscript directory.
 * @param assembly - Container article text naming the bibliography.
 * @param blockFiles - Block contents keyed by `blocks/<file>`.
 * @returns Error findings; empty when bibliography is absent, unreadable or all keys resolve.
 */
export async function checkCitekeys(
  ws: WorkspaceAdapter,
  manuscriptPath: string,
  assembly: string,
  blockFiles: Record<string, string>,
): Promise<CitekeyFinding[]> {
  const ref = bibliographyRef(assembly);
  if (ref === null) return [];
  const location = normalizePath(`${manuscriptPath}/${ref}`);
  const text = await ws.readFile(location);
  if (text === null || text === undefined) return [];
  return checkCitekeysAgainst(text, location, manuscriptPath, blockFiles);
}

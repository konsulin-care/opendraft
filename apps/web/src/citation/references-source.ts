import type { WorkspaceAdapter } from '@opendraft/workspace';
import { parseBibTeX, BibTeXParseError } from '@opendraft/references';
import type { Reference } from '@opendraft/references';

/** Parse failure details for a bib file. */
export interface ReferencesError {
  message: string;
  line: number;
}

/** Result of reading a bib file. */
export interface ReferencesResult {
  items: Reference[];
  error: ReferencesError | null;
}

/**
 * Compute the shared references.bib path for a manuscript directory.
 *
 * @param manuscriptDir - Manuscript directory, e.g. 'manuscripts/p'.
 * @returns Path of references.bib in the parent directory.
 */
export function sharedBibPath(manuscriptDir: string): string {
  const trimmed = manuscriptDir.replace(/\/+$/, '');
  const idx = trimmed.lastIndexOf('/');
  return idx <= 0 ? 'references.bib' : `${trimmed.slice(0, idx)}/references.bib`;
}

/**
 * Read and parse a bib file, surfacing parse errors instead of throwing.
 *
 * @param workspace - Workspace adapter for file I/O.
 * @param bibPath - Path of the bib file.
 * @returns Parsed items and an error (with line) when parsing fails.
 */
export async function readReferences(
  workspace: WorkspaceAdapter,
  bibPath: string,
): Promise<ReferencesResult> {
  const content = await workspace.readFile(bibPath);
  if (!content || !content.trim()) return { items: [], error: null };
  try {
    return { items: parseBibTeX(content), error: null };
  } catch (err) {
    if (err instanceof BibTeXParseError) {
      return { items: [], error: { message: err.message, line: err.line } };
    }
    throw err;
  }
}

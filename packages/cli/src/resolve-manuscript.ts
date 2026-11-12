import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

/** Manuscript entry registered in opendraft.yml. */
export interface ManuscriptEntry {
  /** Manuscript id, e.g. `first-paper`. */
  id: string;
  /** Project-relative manuscript directory, e.g. `manuscripts/first-paper`. */
  path: string;
}

/** Outcome of a manuscript resolution. */
export type ResolveResult =
  | { ok: true; entry: ManuscriptEntry }
  | { ok: false; message: string };

/**
 * Extract registered manuscript entries from a parsed opendraft.yml value.
 *
 * @param data - Parsed YAML document.
 * @returns The listed `{ id, path }` entries, or null when the document is
 *          not an object with a `manuscripts` array.
 */
function listedManuscripts(data: unknown): ManuscriptEntry[] | null {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const manuscripts = (data as { manuscripts?: unknown }).manuscripts;
  if (!Array.isArray(manuscripts)) return [];
  return manuscripts
    .map((entry): ManuscriptEntry | null => {
      if (typeof entry !== 'object' || entry === null) return null;
      const { id, path } = entry as { id?: unknown; path?: unknown };
      if (typeof id !== 'string' || typeof path !== 'string') return null;
      return { id, path };
    })
    .filter((entry): entry is ManuscriptEntry => entry !== null);
}

/**
 * Resolve which manuscript a command should operate on.
 *
 * Reads `opendraft.yml` from the project root and picks the target: an
 * explicit id must be listed, while a missing id only resolves when the
 * project lists exactly one manuscript. Zero or several listed
 * manuscripts without an explicit id fail with a message that lists the
 * available ids, so the caller can report them verbatim.
 *
 * @param root - Project root directory containing opendraft.yml.
 * @param requestedId - Id passed via `-m`, or null when omitted.
 * @returns The chosen entry, or a failure message for stderr.
 */
export function resolveManuscript(root: string, requestedId: string | null): ResolveResult {
  const configPath = join(root, 'opendraft.yml');
  if (!existsSync(configPath)) {
    return { ok: false, message: `No opendraft.yml found in ${root}; run opendraft init first.` };
  }
  let entries: ManuscriptEntry[] | null;
  try {
    entries = listedManuscripts(parse(readFileSync(configPath, 'utf8')));
  } catch {
    entries = null;
  }
  if (entries === null) {
    return { ok: false, message: `Failed to parse ${configPath}.` };
  }
  const ids = entries.map((entry) => entry.id);
  if (requestedId !== null) {
    const found = entries.find((entry) => entry.id === requestedId);
    if (found === undefined) {
      return {
        ok: false,
        message: `Unknown manuscript "${requestedId}"; listed manuscripts: ${ids.join(', ')}.`,
      };
    }
    return { ok: true, entry: found };
  }
  if (entries.length === 0) {
    return {
      ok: false,
      message: 'No manuscripts listed in opendraft.yml; run opendraft manuscript add first.',
    };
  }
  if (entries.length > 1) {
    return {
      ok: false,
      message: `Multiple manuscripts in opendraft.yml; pass -m <id>. Listed manuscripts: ${ids.join(', ')}.`,
    };
  }
  return { ok: true, entry: entries[0] };
}

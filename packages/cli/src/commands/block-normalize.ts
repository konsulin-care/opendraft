import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { normalizeBlockFiles } from '@opendraft/manuscript';
import { NodeFsWorkspace } from '@opendraft/workspace/node';
import { resolveManuscript } from '../resolve-manuscript.js';
import type { ManuscriptEntry } from '../resolve-manuscript.js';

/** Usage line printed for usage errors. */
const NORMALIZE_USAGE = 'usage: opendraft block normalize [dir] [-m <id>]';

/** Parsed `block normalize` arguments. */
interface NormalizeArgs {
  /** Project directory (only positional), or null when absent. */
  dir: string | null;
  /** Manuscript id from `-m`/`--manuscript`, or null when omitted. */
  manuscriptId: string | null;
  /** True when a flag is unknown, lacks its value, or a second positional appears. */
  invalid: boolean;
}

/**
 * Parse `block normalize` arguments: one optional positional plus value flags.
 *
 * @param args - Arguments after `block normalize`.
 * @returns Parsed directory, manuscript id and an invalid-argument marker.
 */
function parseNormalizeArgs(args: string[]): NormalizeArgs {
  const parsed: NormalizeArgs = { dir: null, manuscriptId: null, invalid: false };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '-m' || arg === '--manuscript') {
      const value = args[i + 1];
      if (value === undefined || value.startsWith('-')) {
        parsed.invalid = true;
        return parsed;
      }
      parsed.manuscriptId = value;
      i += 1;
      continue;
    }
    if (arg.startsWith('-')) {
      parsed.invalid = true;
      continue;
    }
    if (parsed.dir === null) parsed.dir = arg;
    else parsed.invalid = true;
  }
  return parsed;
}

/**
 * Extract registered manuscript entries from a parsed opendraft.yml value.
 *
 * @param data - Parsed YAML document.
 * @returns The listed `{ id, path }` entries, or null when the document
 *          is not an object (an unusable config).
 */
function listedEntries(data: unknown): ManuscriptEntry[] | null {
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

/** Outcome of resolving which manuscripts to normalize. */
type TargetsResult =
  | { ok: true; entries: ManuscriptEntry[] }
  | { ok: false; message: string };

/**
 * Resolve the manuscripts `block normalize` operates on.
 *
 * An explicit id is resolved through {@link resolveManuscript}, so an
 * unknown id fails with the same message as the other `block`
 * subcommands. Without `-m` every manuscript registered in
 * `opendraft.yml` is selected; a missing, unparseable or empty config
 * fails with the shared message before any file is touched.
 *
 * @param root - Project root directory containing opendraft.yml.
 * @param requestedId - Id passed via `-m`, or null when omitted.
 * @returns The selected entries, or a failure message for stderr.
 */
function normalizeTargets(root: string, requestedId: string | null): TargetsResult {
  if (requestedId !== null) {
    const resolved = resolveManuscript(root, requestedId);
    return resolved.ok ? { ok: true, entries: [resolved.entry] } : { ok: false, message: resolved.message };
  }
  const configPath = join(root, 'opendraft.yml');
  if (!existsSync(configPath)) {
    return { ok: false, message: `No opendraft.yml found in ${root}; run opendraft init first.` };
  }
  let entries: ManuscriptEntry[] | null;
  try {
    entries = listedEntries(parse(readFileSync(configPath, 'utf8')));
  } catch {
    entries = null;
  }
  if (entries === null) {
    return { ok: false, message: `Failed to parse ${configPath}.` };
  }
  if (entries.length === 0) {
    return {
      ok: false,
      message: 'No manuscripts listed in opendraft.yml; run opendraft manuscript add first.',
    };
  }
  return { ok: true, entries };
}

/**
 * Make a project-relative path relative to the manuscript directory.
 *
 * @param entryPath - Manuscript path, e.g. `manuscripts/demo`.
 * @param path - Project-relative path produced by a rename.
 * @returns The path with the `<entryPath>/` prefix removed.
 */
function relativeToManuscript(entryPath: string, path: string): string {
  const prefix = `${entryPath}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

/**
 * Run the `block normalize` command: migrate legacy block file names.
 *
 * Resolves the target manuscripts from `opendraft.yml` — an explicit
 * `-m` id must be listed, otherwise every registered manuscript is
 * selected — and runs {@link normalizeBlockFiles} over each in order.
 * Every rename prints `renamed <from> -> <to>` on stdout with paths
 * relative to the manuscript directory; every conflicted short (both
 * `blocks/<short>.qmd` and `blocks/_<short>.qmd` exist) prints a
 * conflict line on stderr. Failures resolve 1, conflicts resolve 1
 * after all manuscripts are processed, usage errors resolve 2.
 *
 * @param args - Arguments after the command name: `normalize` followed
 *               by an optional project directory (defaults to the
 *               current working directory) and the `-m`/`--manuscript`
 *               flag.
 * @returns Promise of the exit code: 0 on success, 1 on resolution or
 *          conflict failures, 2 on usage errors.
 */
export async function blockNormalize(args: string[]): Promise<number> {
  const parsed = parseNormalizeArgs(args);
  if (parsed.invalid) {
    console.error(NORMALIZE_USAGE);
    return 2;
  }
  const root = parsed.dir ?? process.cwd();
  const targets = normalizeTargets(root, parsed.manuscriptId);
  if (!targets.ok) {
    console.error(targets.message);
    return 1;
  }
  const ws = new NodeFsWorkspace(root);
  let conflicted = false;
  for (const entry of targets.entries) {
    let result;
    try {
      result = await normalizeBlockFiles(ws, entry.path);
    } catch (err: unknown) {
      console.error(err instanceof Error ? err.message : String(err));
      return 1;
    }
    for (const { from, to } of result.renamed) {
      console.log(
        `renamed ${relativeToManuscript(entry.path, from)} -> ${relativeToManuscript(entry.path, to)}`,
      );
    }
    for (const short of result.conflicts) {
      conflicted = true;
      console.error(
        `conflict: blocks/${short}.qmd exists in both forms in ${entry.path}; left unchanged.`,
      );
    }
  }
  return conflicted ? 1 : 0;
}

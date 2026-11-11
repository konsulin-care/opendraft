import type { WorkspaceAdapter } from '@opendraft/workspace';
import { parse } from 'yaml';

/** Path of the project configuration file at the workspace root. */
const OPENDRAFT_CONFIG_PATH = 'opendraft.yml';

/** File extensions treated as fallback candidates. */
const MARKDOWN_EXTENSIONS = ['.qmd', '.md'];

/**
 * Resolve the default path to open in a workspace.
 *
 * Resolution order:
 * 1. `lastPath`, if it exists in the workspace as a file or as a
 *    directory (a directory matches when any listed path lives under it);
 * 2. the `path` of the first manuscript declared in `opendraft.yml`,
 *    returned as the manuscript directory so the manuscript view opens;
 * 3. the first `.qmd`/`.md` file from `listAll()`;
 * 4. `null` if none of the above applies.
 *
 * @param ws - Workspace adapter to inspect.
 * @param lastPath - Previously opened path (file or directory), or null.
 * @returns The resolved repo-relative path, or null for an empty workspace.
 */
export async function resolveDefaultFile(ws: WorkspaceAdapter, lastPath: string | null): Promise<string | null> {
  const paths = await ws.listAll();

  if (lastPath !== null && pathExists(paths, lastPath)) {
    return lastPath;
  }

  const fromConfig = await resolveFromConfig(ws);
  if (fromConfig) {
    return fromConfig;
  }

  return resolveFromListing(paths);
}

/**
 * Report whether a path exists in the workspace as a file or directory.
 *
 * @param paths - Every repo-relative path in the workspace.
 * @param target - File or directory path to look for.
 * @returns True for an exact file match or a directory containing files.
 */
function pathExists(paths: string[], target: string): boolean {
  const prefix = `${target}/`;
  return paths.some((p) => p === target || p.startsWith(prefix));
}

/**
 * Resolve the first configured manuscript directory from `opendraft.yml`.
 *
 * @param ws - Workspace adapter to read the config from.
 * @returns The first manuscript's directory path (`manuscripts/<id>`), or
 * null when the config is missing, unparseable, or declares no manuscripts.
 */
async function resolveFromConfig(ws: WorkspaceAdapter): Promise<string | null> {
  const raw = await ws.readFile(OPENDRAFT_CONFIG_PATH);
  if (raw === null) {
    return null;
  }

  let config: unknown;
  try {
    config = parse(raw);
  } catch {
    return null;
  }

  const manuscripts = (config as { manuscripts?: unknown } | null)?.manuscripts;
  if (!Array.isArray(manuscripts) || manuscripts.length === 0) {
    return null;
  }

  const first = manuscripts[0] as { path?: unknown };
  if (typeof first?.path !== 'string' || first.path === '') {
    return null;
  }
  return first.path;
}

/**
 * Pick the first `.qmd`/`.md` file from a sorted path listing.
 *
 * @param paths - Sorted repo-relative paths from `listAll()`.
 * @returns The first markdown path, or null if there is none.
 */
function resolveFromListing(paths: string[]): string | null {
  const match = paths.find((p) => MARKDOWN_EXTENSIONS.some((ext) => p.toLowerCase().endsWith(ext)));
  return match ?? null;
}

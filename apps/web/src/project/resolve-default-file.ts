import type { WorkspaceAdapter } from '@opendraft/workspace';
import { parse } from 'yaml';

/** Path of the project configuration file at the workspace root. */
const OPENDRAFT_CONFIG_PATH = 'opendraft.yml';

/** File extensions treated as the first-choice fallback candidates. */
const MARKDOWN_EXTENSIONS = ['.qmd', '.md'];

/**
 * Resolve the default file to open in a workspace.
 *
 * Resolution order:
 * 1. `lastPath`, if that file exists in the workspace;
 * 2. the first sorted `blocks/*.qmd` under `<manuscripts[0].path>/`,
 *    parsed from `opendraft.yml` (ULID names sort chronologically);
 * 3. `<manuscripts[0].path>/article.qmd`, when no block exists;
 * 4. the first `.qmd`/`.md` file from `listAll()`;
 * 5. `null` if none of the above applies.
 *
 * @param ws - Workspace adapter to inspect.
 * @param lastPath - Previously opened path, or null when none is stored.
 * @returns The resolved repo-relative path, or null for an empty workspace.
 */
export async function resolveDefaultFile(ws: WorkspaceAdapter, lastPath: string | null): Promise<string | null> {
  if (lastPath) {
    const content = await ws.readFile(lastPath);
    if (content !== null) {
      return lastPath;
    }
  }

  const fromConfig = await resolveFromConfig(ws);
  if (fromConfig) {
    return fromConfig;
  }

  return resolveFromListing(await ws.listAll());
}

/**
 * Resolve the default file inside the first configured manuscript.
 *
 * Prefers the first sorted `blocks/*.qmd` file; falls back to the
 * container `article.qmd` only when no block exists.
 *
 * @param ws - Workspace adapter to read the config from and list blocks.
 * @returns The first block path, `<manuscriptPath>/article.qmd`, or null
 * when the config is missing, unparseable, or declares no manuscripts.
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

  const block = await resolveFirstBlock(ws, first.path);
  if (block) {
    return block;
  }

  return `${first.path}/article.qmd`;
}

/**
 * Find the first sorted `blocks/*.qmd` file under a manuscript.
 *
 * @param ws - Workspace adapter to list the blocks directory from.
 * @param manuscriptPath - Repo-relative path of the manuscript.
 * @returns The first block path by sorted name, or null when no block exists.
 */
async function resolveFirstBlock(ws: WorkspaceAdapter, manuscriptPath: string): Promise<string | null> {
  const names = await ws.listFiles(`${manuscriptPath}/blocks`);
  const first = names
    .filter((name) => name.toLowerCase().endsWith('.qmd'))
    .sort()[0];
  return first ? `${manuscriptPath}/blocks/${first}` : null;
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

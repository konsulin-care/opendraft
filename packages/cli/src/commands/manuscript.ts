import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { addManuscript } from '@opendraft/manuscript';
import { MANUSCRIPT_ID_PATTERN } from '@opendraft/schema';
import { NodeFsWorkspace } from '@opendraft/workspace/node';

/** Usage line printed for usage errors. */
const MANUSCRIPT_USAGE = 'usage: opendraft manuscript add <id> [dir]';

/**
 * Extract the registered manuscript ids from `opendraft.yml` text.
 *
 * @param configText - Contents of the project config file.
 * @returns Ids listed under `manuscripts`, or null when the text is not
 *          parseable as a YAML object.
 */
function listedIds(configText: string): string[] | null {
  let data: unknown;
  try {
    data = parse(configText);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const manuscripts = (data as { manuscripts?: unknown }).manuscripts;
  if (!Array.isArray(manuscripts)) return [];
  return manuscripts
    .map((entry) =>
      typeof entry === 'object' && entry !== null ? (entry as { id?: unknown }).id : undefined,
    )
    .filter((id): id is string => typeof id === 'string');
}

/**
 * Run the `manuscript` command; currently only the `add` subcommand.
 *
 * `manuscript add <id> [dir]` creates the starter files for a new
 * manuscript under `manuscripts/<id>/` and registers it in
 * `opendraft.yml`. All rejections are decided before any write: a
 * missing project root config, an invalid id, an unparseable config,
 * or an id already listed all return 1 without writing. The
 * registration itself is awaited, so when the command resolves every
 * starter file and the config update are on disk.
 *
 * @param args - Arguments after the command name: `add` followed by the
 *               manuscript id and an optional project directory
 *               (defaults to the current working directory).
 * @returns Promise of the exit code: 0 when the manuscript is created
 *          and registered, 1 on rejections or write failures, 2 on
 *          usage errors.
 */
export async function manuscriptCommand(args: string[]): Promise<number> {
  const [subcommand, ...rest] = args;
  if (subcommand !== 'add') {
    console.error(MANUSCRIPT_USAGE);
    return 2;
  }
  const positional = rest.filter((arg) => !arg.startsWith('--'));
  const [id, dirArg] = positional;
  if (id === undefined) {
    console.error(MANUSCRIPT_USAGE);
    return 2;
  }
  const root = dirArg ?? process.cwd();
  const configPath = join(root, 'opendraft.yml');
  if (!existsSync(configPath)) {
    console.error(`No opendraft.yml found in ${root}; run opendraft init first.`);
    return 1;
  }
  if (!MANUSCRIPT_ID_PATTERN.test(id)) {
    console.error(
      `Invalid manuscript id "${id}": must be lowercase alphanumeric with hyphens.`,
    );
    return 1;
  }
  const ids = listedIds(readFileSync(configPath, 'utf8'));
  if (ids === null) {
    console.error(`Failed to parse ${configPath}.`);
    return 1;
  }
  if (ids.includes(id)) {
    console.error(`Manuscript "${id}" is already listed in opendraft.yml.`);
    return 1;
  }
  try {
    await addManuscript(new NodeFsWorkspace(root), id);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    return 1;
  }
  return 0;
}

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { scaffoldProject } from '@opendraft/manuscript';
import type { ProtocolBlock } from '@opendraft/manuscript';
import { MANUSCRIPT_ID_PATTERN } from '@opendraft/schema';
import { NodeFsWorkspace } from '@opendraft/workspace/node';
import { BUNDLED_PROTOCOL_LATEST } from '../protocol.js';

/** Usage line printed for flag errors. */
const INIT_USAGE = 'usage: opendraft init [dir] --manuscript <id>';

/** Canonical protocol repository recorded in scaffolded configs. */
const PROTOCOL_REPOSITORY = 'https://github.com/konsulin-care/opendraft';

/** Protocol block for scaffolded projects: the embedded revision. */
const PROTOCOL: ProtocolBlock = {
  name: 'opendraft',
  version: BUNDLED_PROTOCOL_LATEST,
  repository: PROTOCOL_REPOSITORY,
  commit: BUNDLED_PROTOCOL_LATEST,
};

/** Parsed `init` arguments. */
interface InitArgs {
  /** Project root directory (first positional), or null when absent. */
  dir: string | null;
  /** Manuscript id from `--manuscript`, or null when missing. */
  manuscriptId: string | null;
  /** True when an unknown flag was seen or `--manuscript` lacks a value. */
  invalid: boolean;
}

/**
 * Parse `init` arguments: one positional directory and `--manuscript <id>`.
 *
 * @param args - Arguments after the command name.
 * @returns Parsed directory, manuscript id and an invalid-flag marker.
 */
function parseArgs(args: string[]): InitArgs {
  let dir: string | null = null;
  let manuscriptId: string | null = null;
  let invalid = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--manuscript') {
      const value = args[i + 1];
      if (value === undefined || value.startsWith('--')) {
        return { dir, manuscriptId: null, invalid: true };
      }
      manuscriptId = value;
      i += 1;
      continue;
    }
    if (arg.startsWith('--')) {
      invalid = true;
      continue;
    }
    if (dir === null) dir = arg;
  }
  return { dir, manuscriptId, invalid };
}

/**
 * Run the `init` command: scaffold a new project into a directory.
 *
 * Rejects a target that already contains `opendraft.yml` (writing
 * nothing) and an invalid manuscript id, then scaffolds the project
 * through a {@link NodeFsWorkspace} using the embedded protocol
 * revision. The scaffold is awaited, so when the command resolves
 * every scaffold file — including `opendraft.yml` and the initial
 * manuscript — is on disk.
 *
 * @param args - Arguments after the command name: optional project
 *               directory (defaults to the current working directory)
 *               and the required `--manuscript <id>` flag.
 * @returns Promise of the exit code: 0 when the scaffold completes, 1
 *          when the target already has a config, the id is invalid or
 *          a write fails, 2 on usage errors.
 */
export async function initCommand(args: string[]): Promise<number> {
  const { dir, manuscriptId, invalid } = parseArgs(args);
  if (invalid || manuscriptId === null) {
    console.error(INIT_USAGE);
    return 2;
  }
  const root = dir ?? process.cwd();
  if (existsSync(join(root, 'opendraft.yml'))) {
    console.error(`${root} already contains opendraft.yml; refusing to overwrite.`);
    return 1;
  }
  if (!MANUSCRIPT_ID_PATTERN.test(manuscriptId)) {
    console.error(
      `Invalid manuscript id "${manuscriptId}": must be lowercase alphanumeric with hyphens.`,
    );
    return 1;
  }
  try {
    await scaffoldProject(new NodeFsWorkspace(root), { manuscriptId, protocol: PROTOCOL });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    return 1;
  }
  return 0;
}

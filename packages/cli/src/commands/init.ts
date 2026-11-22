import {
  applyPlan,
  discoverProject,
  normalizeManuscriptId,
  OPENDRAFT_CONFIG_PATH,
  planInit,
} from '@opendraft/manuscript';
import type { InitDecisions, ProjectDiscovery, ProtocolBlock } from '@opendraft/manuscript';
import { NodeFsWorkspace } from '@opendraft/workspace/node';
import { BUNDLED_PROTOCOL_LATEST } from '../protocol.js';
import { DEFAULT_INIT_IO } from './init-io.js';
import type { InitIo } from './init-io.js';

/** Usage line printed for flag errors. */
const INIT_USAGE = 'usage: opendraft init [dir] [--manuscript <id>]';

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
  /** Optional manuscript id from `--manuscript`. */
  manuscriptId: string | null;
  /** True when an unknown flag was seen or `--manuscript` lacks a value. */
  invalid: boolean;
}

/**
 * Parse `init` arguments: one optional positional directory and
 * `--manuscript <id>`.
 *
 * @param args - Arguments after the command name.
 * @returns Parsed directory, optional manuscript id, and invalid-flag marker.
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
 * Report invalid configuration errors and decide nothing else.
 *
 * @param discovery - Discovery result whose config state is invalid.
 */
function reportConfigErrors(discovery: ProjectDiscovery): void {
  console.error(`Invalid ${OPENDRAFT_CONFIG_PATH}:`);
  for (const error of discovery.configErrors) console.error(`  ${error}`);
}

/**
 * Ask for confirmation before registering unlisted manuscripts.
 *
 * @param io - Interaction surface for prompts.
 * @param unlisted - Registrable candidate ids absent from the configuration.
 * @returns The ids to register; empty when the user declines.
 */
async function confirmUnlisted(io: InitIo, unlisted: string[]): Promise<string[]> {
  if (!io.interactive) return unlisted;
  const answer = await io.ask(
    `Register unlisted manuscripts (${unlisted.join(', ')})? [y/N] `,
  );
  return /^y(es)?$/i.test(answer.trim()) ? unlisted : [];
}

/**
 * Choose the manuscript id for a brand new project.
 *
 * @param io - Interaction surface for prompts.
 * @param manuscriptId - Id supplied through `--manuscript`, if any.
 * @returns The id to scaffold, or null when non-interactive input lacks one.
 */
async function chooseNewManuscriptId(
  io: InitIo,
  manuscriptId: string | null,
): Promise<string | null> {
  if (manuscriptId !== null) return manuscriptId;
  if (!io.interactive) return null;
  const answer = await io.ask('Project name: ');
  return normalizeManuscriptId(answer);
}

/**
 * Decide what init should do after discovery.
 *
 * @param io - Interaction surface for prompts.
 * @param discovery - Read-only discovery result for the project.
 * @param manuscriptId - Id supplied through `--manuscript`, if any.
 * @returns Decisions to plan, or an immediate exit code.
 */
async function resolveDecisions(
  io: InitIo,
  discovery: ProjectDiscovery,
  manuscriptId: string | null,
): Promise<{ decisions: InitDecisions } | { exit: number }> {
  if (discovery.config === 'valid') {
    if (discovery.unlisted.length === 0) {
      console.log('nothing to do');
      return { exit: 0 };
    }
    const confirmed = await confirmUnlisted(io, discovery.unlisted);
    if (confirmed.length === 0) {
      console.log('nothing to do');
      return { exit: 0 };
    }
    return { decisions: { addUnlisted: confirmed } };
  }

  const registrable = discovery.candidates
    .filter((candidate) => candidate.status === 'valid' || candidate.status === 'repairable')
    .map((candidate) => candidate.id);
  if (registrable.length > 0) return { decisions: { register: registrable } };

  const id = await chooseNewManuscriptId(io, manuscriptId);
  if (id === null) {
    console.error(
      'No existing manuscripts found. Provide --manuscript <id> to scaffold a new one.',
    );
    return { exit: 2 };
  }
  return { decisions: { newManuscriptId: id } };
}

/**
 * Run `opendraft init` on top of discovery, plan, and apply.
 *
 * Discovery never rewrites an invalid configuration: it is reported and the
 * command exits 1. A valid configuration with no unlisted registrable
 * folders reports `nothing to do` and exits 0. Otherwise the command
 * registers all registrable candidates, scaffolding a new manuscript only
 * when none exists. `--manuscript` is therefore optional and used only when
 * there is no registrable candidate. Non-interactive runs without a
 * candidate or an id exit 2.
 *
 * @param args - Arguments after the command name: optional project
 *               directory and optional `--manuscript <id>`.
 * @param io - Injectable interaction surface; non-interactive by default.
 * @returns Promise of the exit code: 0 on success or nothing to do, 1 for
 *          invalid config, invalid id, or write failure, 2 on usage errors.
 */
export async function initCommand(
  args: string[],
  io: InitIo = DEFAULT_INIT_IO,
): Promise<number> {
  const { dir, manuscriptId, invalid } = parseArgs(args);
  if (invalid) {
    console.error(INIT_USAGE);
    return 2;
  }

  const root = dir ?? process.cwd();
  const ws = new NodeFsWorkspace(root);

  let discovery: ProjectDiscovery;
  try {
    discovery = await discoverProject(ws);
  } catch (err: unknown) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }

  if (discovery.config === 'invalid') {
    reportConfigErrors(discovery);
    return 1;
  }

  const decisions = await resolveDecisions(io, discovery, manuscriptId);
  if ('exit' in decisions) return decisions.exit;

  try {
    const plan = await planInit(ws, discovery, decisions.decisions, { protocol: PROTOCOL });
    await applyPlan(ws, plan);
  } catch (err: unknown) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
  return 0;
}

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { addBlock, extractIncludes } from '@opendraft/manuscript';
import type { CreateBlockDraft } from '@opendraft/manuscript';
import { NodeFsWorkspace } from '@opendraft/workspace/node';
import { resolveManuscript } from '../resolve-manuscript.js';

/** Usage line printed for usage errors. */
const BLOCK_USAGE =
  'usage: opendraft block add <title> [dir] [-m <id>] [--after <short>] [--type <type>]';

/** Section type pattern: lowercase alphanumeric groups joined by hyphens. */
const TYPE_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Parsed `block add` arguments. */
interface BlockAddArgs {
  /** Block heading title (first positional). */
  title: string | null;
  /** Project directory (second positional), or null when absent. */
  dir: string | null;
  /** Manuscript id from `-m`/`--manuscript`, or null when omitted. */
  manuscriptId: string | null;
  /** Short name the include must follow, from `--after`. */
  after: string | null;
  /** Section type from `--type`, without the `deo-` prefix. */
  type: string | null;
  /** True when a flag is unknown or lacks its value. */
  invalid: boolean;
}

/**
 * Parse `block add` arguments: two positionals plus value flags.
 *
 * @param args - Arguments after `block add`.
 * @returns Parsed positionals, flags and an invalid-flag marker.
 */
function parseArgs(args: string[]): BlockAddArgs {
  const parsed: BlockAddArgs = {
    title: null,
    dir: null,
    manuscriptId: null,
    after: null,
    type: null,
    invalid: false,
  };
  const valueFlags: Record<string, keyof Pick<BlockAddArgs, 'manuscriptId' | 'after' | 'type'>> = {
    '-m': 'manuscriptId',
    '--manuscript': 'manuscriptId',
    '--after': 'after',
    '--type': 'type',
  };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const key = valueFlags[arg];
    if (key !== undefined) {
      const value = args[i + 1];
      if (value === undefined || value.startsWith('-')) {
        parsed.invalid = true;
        return parsed;
      }
      parsed[key] = value;
      i += 1;
      continue;
    }
    if (arg.startsWith('-')) {
      parsed.invalid = true;
      continue;
    }
    if (parsed.title === null) parsed.title = arg;
    else if (parsed.dir === null) parsed.dir = arg;
    else parsed.invalid = true;
  }
  return parsed;
}

/**
 * Run the `block add` command: write a block file and its include line.
 *
 * Resolves the target manuscript from `opendraft.yml` (an explicit `-m`
 * id, otherwise the project's only manuscript) and rejects ambiguous
 * projects with a message listing the ids before any write. The include
 * slot is computed synchronously from `article.qmd` — `--after <short>`
 * places it directly after that block, otherwise it appends — then the
 * block file and assembly are written asynchronously through
 * {@link addBlock}; the returned code reflects the pre-write checks.
 *
 * @param args - Arguments after the command name: `add` followed by the
 *               block title, an optional project directory (defaults to
 *               the current working directory) and the flags above.
 * @returns Exit code: 0 when the write starts, 1 on resolution failures,
 *          2 on usage errors.
 */
export function blockCommand(args: string[]): number {
  const [subcommand, ...rest] = args;
  if (subcommand !== 'add') {
    console.error(BLOCK_USAGE);
    return 2;
  }
  const parsed = parseArgs(rest);
  if (parsed.invalid || parsed.title === null) {
    console.error(BLOCK_USAGE);
    return 2;
  }
  if (parsed.type !== null && !TYPE_PATTERN.test(parsed.type)) {
    console.error(`Invalid --type "${parsed.type}": must be lowercase alphanumeric with hyphens.`);
    return 1;
  }
  const root = parsed.dir ?? process.cwd();
  const resolved = resolveManuscript(root, parsed.manuscriptId);
  if (!resolved.ok) {
    console.error(resolved.message);
    return 1;
  }
  const entry = resolved.entry;
  const articlePath = join(root, entry.path, 'article.qmd');
  const article = existsSync(articlePath) ? readFileSync(articlePath, 'utf8') : null;
  const shorts = article === null ? [] : extractIncludes(article);
  let position = shorts.length;
  if (parsed.after !== null) {
    const index = article === null ? -1 : shorts.indexOf(parsed.after);
    if (index === -1) {
      console.error(`No block "${parsed.after}" is included in ${entry.path}/article.qmd.`);
      return 1;
    }
    position = index + 1;
  }
  const title = parsed.title;
  const draft: string | CreateBlockDraft =
    parsed.type === null ? title : { title, short: title, role: parsed.type };
  void addBlock(new NodeFsWorkspace(root), entry.path, position, draft).catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
  });
  return 0;
}

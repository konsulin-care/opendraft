import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { addBlock, extractIncludes, listBlocks, normalizeBlockFiles } from '@opendraft/manuscript';
import type { CreateBlockDraft } from '@opendraft/manuscript';
import { SECTION_ROLES } from '@opendraft/schema';
import { NodeFsWorkspace } from '@opendraft/workspace/node';
import { blockNormalize } from './block-normalize.js';
import { resolveManuscript } from '../resolve-manuscript.js';

/** Usage lines printed for usage errors. */
const BLOCK_USAGE = [
  'usage: opendraft block add <title> [dir] [-m <id>] [--after <short>] [--type <type>]',
  '       opendraft block ls [dir] [-m <id>]',
  '       opendraft block normalize [dir] [-m <id>]',
].join('\n');

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

/** Parsed `block ls` arguments. */
interface BlockLsArgs {
  /** Project directory (only positional), or null when absent. */
  dir: string | null;
  /** Manuscript id from `-m`/`--manuscript`, or null when omitted. */
  manuscriptId: string | null;
  /** True when a flag is unknown, lacks its value, or a second positional appears. */
  invalid: boolean;
}

/**
 * Parse `block ls` arguments: one optional positional plus value flags.
 *
 * @param args - Arguments after `block ls`.
 * @returns Parsed directory, manuscript id and an invalid-argument marker.
 */
function parseLsArgs(args: string[]): BlockLsArgs {
  const parsed: BlockLsArgs = { dir: null, manuscriptId: null, invalid: false };
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
 * Run the `block ls` command: print one line per included block.
 *
 * Resolves the target manuscript from `opendraft.yml` the same way as
 * `block add` — an explicit `-m` id must be listed, otherwise the
 * project's only manuscript is used — and prints the failure message
 * with exit code 1 for unknown ids. Blocks are then read through
 * {@link listBlocks}, which resolves each include to the on-disk file
 * (prefixed `_<short>.qmd` first, legacy `<short>.qmd` as fallback).
 * On success every include line of `article.qmd` yields
 * `short<TAB>title` on stdout, in include order, with the block file's
 * heading title falling back to the short name when the file or heading
 * is missing. All output is printed before the command returns.
 *
 * @param args - Arguments after the command name: `ls` followed by an
 *               optional project directory (defaults to the current
 *               working directory) and the `-m`/`--manuscript` flag.
 * @returns Promise of the exit code: 0 on success, 1 on resolution
 *          failures, 2 on usage errors.
 */
async function blockLs(args: string[]): Promise<number> {
  const parsed = parseLsArgs(args);
  if (parsed.invalid) {
    console.error(BLOCK_USAGE);
    return 2;
  }
  const root = parsed.dir ?? process.cwd();
  const resolved = resolveManuscript(root, parsed.manuscriptId);
  if (!resolved.ok) {
    console.error(resolved.message);
    return 1;
  }
  const items = await listBlocks(new NodeFsWorkspace(root), resolved.entry.path);
  for (const item of items) {
    console.log(`${item.short}\t${item.title}`);
  }
  return 0;
}

/**
 * Compute the include slot for a new block in the assembly.
 *
 * Reads the include short names from the article text (accepting both
 * canonical and legacy include lines). Without `--after` the slot is
 * the end of the list; with `--after <short>` it directly follows that
 * block, or the slot is missing when the target is not included.
 *
 * @param article - Full `article.qmd` text, or null when the file is absent.
 * @param after - Short name from `--after`, or null to append.
 * @param entryPath - Manuscript path used in the missing-target message.
 * @returns Insertion index, or -1 when `--after` names no included block.
 */
function includePosition(article: string | null, after: string | null, entryPath: string): number {
  const shorts = article === null ? [] : extractIncludes(article);
  if (after === null) return shorts.length;
  const index = shorts.indexOf(after);
  if (index === -1) {
    console.error(`No block "${after}" is included in ${entryPath}/article.qmd.`);
    return -1;
  }
  return index + 1;
}

/**
 * Normalize legacy block files, then write the new block and include line.
 *
 * @param root - Project directory the workspace is rooted at.
 * @param entryPath - Manuscript path relative to the project root.
 * @param position - Include slot returned by {@link includePosition}.
 * @param draft - Block heading title, or a typed draft from `--type`.
 * @returns Promise of the exit code: 0 on success, 1 on write failure.
 */
async function writeNewBlock(
  root: string,
  entryPath: string,
  position: number,
  draft: string | CreateBlockDraft,
): Promise<number> {
  const ws = new NodeFsWorkspace(root);
  try {
    await normalizeBlockFiles(ws, entryPath);
    await addBlock(ws, entryPath, position, draft);
    return 0;
  } catch (err: unknown) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

/**
 * Run the `block add` command: write a block file and its include line.
 *
 * Resolves the target manuscript from `opendraft.yml` (an explicit `-m`
 * id, otherwise the project's only manuscript) and rejects ambiguous
 * projects with a message listing the ids before any write. A `--type`
 * value outside `SECTION_ROLES` is rejected with exit code 1 before any
 * write as well. The include slot is computed from `article.qmd` —
 * `--after <short>` places it directly after that block, otherwise it
 * appends — then legacy files are normalized and the block written via
 * {@link writeNewBlock}; only write failures then produce exit code 1.
 *
 * @param args - Arguments after the command name: `add` followed by the
 *               block title, an optional project directory (defaults to
 *               the current working directory) and the flags above.
 * @returns Promise of the exit code: 0 when the operation succeeds,
 *          1 on resolution, type or write failures, 2 on usage errors.
 */
async function blockAdd(args: string[]): Promise<number> {
  const parsed = parseArgs(args);
  if (parsed.invalid || parsed.title === null) {
    console.error(BLOCK_USAGE);
    return 2;
  }
  if (parsed.type !== null && !SECTION_ROLES.includes(parsed.type)) {
    console.error(
      `Invalid --type "${parsed.type}": must be one of the known section types ` +
        '(e.g. introduction, methods, results, discussion).',
    );
    return 1;
  }
  const root = parsed.dir ?? process.cwd();
  const resolved = resolveManuscript(root, parsed.manuscriptId);
  if (!resolved.ok) {
    console.error(resolved.message);
    return 1;
  }
  const articlePath = join(root, resolved.entry.path, 'article.qmd');
  const article = existsSync(articlePath) ? readFileSync(articlePath, 'utf8') : null;
  const position = includePosition(article, parsed.after, resolved.entry.path);
  if (position === -1) return 1;
  const title = parsed.title;
  const draft: string | CreateBlockDraft =
    parsed.type === null ? title : { title, short: title, role: parsed.type };
  return await writeNewBlock(root, resolved.entry.path, position, draft);
}

/**
 * Run the `block` command: dispatch `ls`, `add`, `normalize`, or print usage.
 *
 * Dispatches `ls` to {@link blockLs}, `add` to {@link blockAdd} and
 * `normalize` to {@link blockNormalize}; anything else prints the
 * usage and exits 2.
 *
 * @param args - Arguments after the command name: `add` followed by the
 *               block title, an optional project directory and the
 *               flags above; `ls` or `normalize` with an optional
 *               directory and `-m <id>`.
 * @returns Promise of the exit code: 0 when the operation succeeds,
 *          1 on resolution, type or write failures, 2 on usage errors.
 */
export async function blockCommand(args: string[]): Promise<number> {
  const [subcommand, ...rest] = args;
  if (subcommand === 'ls') return await blockLs(rest);
  if (subcommand === 'add') return await blockAdd(rest);
  if (subcommand === 'normalize') return await blockNormalize(rest);
  console.error(BLOCK_USAGE);
  return 2;
}

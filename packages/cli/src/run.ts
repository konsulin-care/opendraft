import { blockCommand } from './commands/block.js';
import { initCommand } from './commands/init.js';
import { manuscriptCommand } from './commands/manuscript.js';
import { rdfCommand } from './commands/rdf.js';
import { validateCommand } from './commands/validate.js';

const USAGE = [
  'usage: opendraft <command> [arguments]',
  'commands:',
  '  validate [dir] [--json] [--offline] [--release]  Validate config, metadata and assemblies',
  '  init [dir] --manuscript <id>  Scaffold a new project',
  '  manuscript              Manage manuscripts',
  '  block                   Manage blocks',
  '  rdf [dir] [-m <id>]     Print the manuscript RDF graph as Turtle',
].join('\n');

/**
 * Run the OpenDraft CLI with the given arguments.
 *
 * Pure dispatch: never touches `process.argv`, never calls
 * `process.exit`, and never mutates process state — it only prints the
 * command's report to the console and returns the exit code, so it is
 * safe to import and call from tests. Commands migrated to
 * `Promise<number>` (`init`, `manuscript` and `block`) are not
 * dispatched here: they fall through to the usage error, so use
 * {@link runCommand} for them.
 *
 * @param args - CLI arguments, excluding the node executable and script.
 * @returns Exit code: 0 on success, 1 on validation failure, 2 on usage errors.
 */
export function runCli(args: string[]): number {
  const [command] = args;
  if (command === '--help') {
    console.log(USAGE);
    return 0;
  }
  console.error(USAGE);
  return 2;
}

/**
 * Run the OpenDraft CLI asynchronously with the given arguments.
 *
 * The complete dispatch — every command, including the async
 * `init`, `manuscript` and `block` handlers omitted from {@link
 * runCli} — awaits each handler, so all writes are settled and the
 * exit code reflects the finished operation. Like `runCli`, it never
 * touches `process.argv`, never calls `process.exit`, and never mutates
 * process state.
 *
 * @param args - CLI arguments, excluding the node executable and script.
 * @returns Promise of the exit code: 0 on success, 1 on validation
 *          failure, 2 on usage errors.
 */
export async function runCommand(args: string[]): Promise<number> {
  const [command, ...rest] = args;
  if (command === '--help') {
    console.log(USAGE);
    return 0;
  }
  if (command === 'validate') return await validateCommand(rest);
  if (command === 'init') return await initCommand(rest);
  if (command === 'manuscript') return await manuscriptCommand(rest);
  if (command === 'block') return await blockCommand(rest);
  if (command === 'rdf') return await rdfCommand(rest);
  console.error(USAGE);
  return 2;
}

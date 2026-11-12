import { initCommand } from './commands/init.js';
import { manuscriptCommand } from './commands/manuscript.js';
import { validateCommand } from './commands/validate.js';

const USAGE = [
  'usage: opendraft <command> [arguments]',
  'commands:',
  '  validate [dir] [--json]  Validate config, metadata and assemblies',
  '  init [dir] --manuscript <id>  Scaffold a new project',
  '  manuscript              Manage manuscripts',
  '  block                   Manage blocks',
].join('\n');

/**
 * Run the OpenDraft CLI with the given arguments.
 *
 * Pure dispatch: never touches `process.argv`, never calls
 * `process.exit`, and never mutates process state — it only prints the
 * command's report to the console and returns the exit code, so it is
 * safe to import and call from tests.
 *
 * @param args - CLI arguments, excluding the node executable and script.
 * @returns Exit code: 0 on success, 1 on validation failure, 2 on usage errors.
 */
export function runCli(args: string[]): number {
  const [command, ...rest] = args;
  if (command === '--help') {
    console.log(USAGE);
    return 0;
  }
  if (command === 'validate') return validateCommand(rest);
  if (command === 'init') return initCommand(rest);
  if (command === 'manuscript') return manuscriptCommand(rest);
  console.error(USAGE);
  return 2;
}

import { validateCommand } from './commands/validate.js';

const USAGE = 'usage: opendraft <command> [arguments]\ncommands:\n  validate [dir]  Validate config, metadata and assemblies';

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
  if (command === 'validate') return validateCommand(rest);
  console.error(USAGE);
  return 2;
}

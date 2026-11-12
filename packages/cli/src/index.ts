import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { runCli } from './run.js';

export { runCli };

/**
 * Decide whether this module is the invoked executable entry.
 *
 * Matches `import.meta.url` against the URL of `process.argv[1]`, then
 * against the symlink-resolved path, so the guard also holds when the
 * CLI runs through an installed `node_modules/.bin` link.
 *
 * @param invokedPath - Script path from `process.argv[1]`.
 * @returns True when this module is the invoked entry point.
 */
function isDirectInvocation(invokedPath: string): boolean {
  if (import.meta.url === pathToFileURL(invokedPath).href) return true;
  try {
    return import.meta.url === pathToFileURL(realpathSync(invokedPath)).href;
  } catch {
    return false;
  }
}

// Executable entry for the `opendraft` bin. The guard keeps importing
// this module side-effect free: only a direct `node dist/index.js` (or
// installed bin) invocation runs the CLI; test imports just receive
// `runCli`.
const invokedPath = process.argv[1];
if (invokedPath !== undefined && isDirectInvocation(invokedPath)) {
  process.exitCode = runCli(process.argv.slice(2));
}

import { pathToFileURL } from 'node:url';
import { runCli } from './run.js';

export { runCli };

// Executable entry for the `opendraft` bin. The guard keeps importing
// this module side-effect free: only a direct `node dist/index.js`
// invocation runs the CLI; test imports just receive `runCli`.
const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  process.exitCode = runCli(process.argv.slice(2));
}

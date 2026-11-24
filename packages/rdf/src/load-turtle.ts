import { parseTurtle } from './parse.js';
import type { TurtleDataset } from './types.js';

/**
 * Parses a Turtle (.ttl) file into an RDF/JS DatasetCore.
 *
 * The filesystem read is loaded through a dynamic import so this module keeps
 * no static `node:` imports and stays browser-safe. This is the only module in
 * `packages/rdf/src` allowed to reference a `node:` specifier.
 *
 * @param path - Filesystem path to the Turtle file.
 * @returns Resolves to a dataset containing every quad in the file.
 * @throws When the file cannot be read or parsed as Turtle.
 */
export async function loadTurtle(path: string): Promise<TurtleDataset> {
  const { readFile } = await import('node:fs/promises');
  const content = await readFile(path, 'utf8');
  return parseTurtle(content);
}

import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseDocument } from 'yaml';
import history from '../../../rdf/src/protocol-history.generated.json';

/**
 * Pin protocol.version and protocol.commit in opendraft.yml to the
 * bundled history `latest`, preserving other keys and comments.
 *
 * @param args - optional project directory.
 * @returns exit code: 0 on success or up to date, 1 on failure, 2 on usage error.
 */
export async function protocolUpgradeCommand(args: string[]): Promise<number> {
  if (args.length > 1 || args[0]?.startsWith('-')) {
    console.error('usage: opendraft protocol upgrade [dir]');
    return 2;
  }
  const file = join(resolve(args[0] ?? '.'), 'opendraft.yml');
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    console.error(`cannot read ${file}`);
    return 1;
  }
  const doc = parseDocument(text);
  const latest = history.latest;
  if (doc.getIn(['protocol', 'commit']) === latest && doc.getIn(['protocol', 'version']) === latest) {
    console.log('protocol already up to date');
    return 0;
  }
  doc.setIn(['protocol', 'version'], latest);
  doc.setIn(['protocol', 'commit'], latest);
  await writeFile(file, doc.toString());
  console.log(`protocol upgraded to ${latest}`);
  return 0;
}

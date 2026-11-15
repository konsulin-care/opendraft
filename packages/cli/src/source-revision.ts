import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * Returns HEAD's SHA when `path` has no uncommitted changes, else undefined.
 * @param path directory or file to check (also used as git cwd's pathspec)
 */
export async function sourceRevision(path: string): Promise<string | undefined> {
  try {
    const status = await run('git', ['status', '--porcelain', '--', '.'], { cwd: path });
    if (status.stdout.trim() !== '') return undefined;
    const head = await run('git', ['rev-parse', 'HEAD'], { cwd: path });
    const sha = head.stdout.trim();
    return /^[0-9a-f]{40}$/.test(sha) ? sha : undefined;
  } catch {
    return undefined;
  }
}

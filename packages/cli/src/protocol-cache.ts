import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/** Default cache base dir: `${XDG_CACHE_HOME ?? ~/.cache}/opendraft/protocol`. */
export function defaultProtocolCacheDir(): string {
  const root = process.env.XDG_CACHE_HOME || join(homedir(), '.cache');
  return join(root, 'opendraft', 'protocol');
}

/** File cache storing values at `<base>/<sha>/<path>`; keys are `<sha>/<path>`. */
export class FileProtocolCache {
  constructor(private readonly baseDir: string = defaultProtocolCacheDir()) {}

  /** Returns the cached value, or null when missing. */
  async get(key: string): Promise<string | null> {
    try {
      return await readFile(join(this.baseDir, key), 'utf8');
    } catch {
      return null;
    }
  }

  /** Stores a value under the key, creating directories as needed. */
  async set(key: string, value: string): Promise<void> {
    const file = join(this.baseDir, key);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, value, 'utf8');
  }
}

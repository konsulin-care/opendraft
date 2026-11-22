import git from 'isomorphic-git';
import type { FsClient } from 'isomorphic-git';

/** Options for committing a set of files onto a branch. */
export interface CommitFilesOnBranchOptions {
  branch: string;
  files: Map<string, string>;
  /** Repository-relative paths to delete from the working tree and stage as removals. */
  remove?: string[];
  message: string;
  author: { name: string; email: string };
}

/** Promise-based filesystem client used by isomorphic-git. */
interface PromiseFs {
  readFile: (filepath: string) => Promise<unknown>;
  writeFile: (filepath: string, data: Uint8Array | string) => Promise<unknown>;
  mkdir: (filepath: string, opts?: { recursive?: boolean }) => Promise<unknown>;
  unlink: (filepath: string) => Promise<unknown>;
}

/**
 * Extract the promise-based API from an isomorphic-git filesystem client.
 * @param fs - Isomorphic-git filesystem client.
 * @returns Promise-based filesystem API.
 */
function getPromiseFs(fs: FsClient): PromiseFs {
  if ('promises' in fs && fs.promises) {
    return fs.promises as unknown as PromiseFs;
  }
  throw new Error('commitFilesOnBranch requires a promise-based filesystem');
}

/**
 * Join a repository directory with a repository-relative path.
 * @param dir - Repository directory.
 * @param filepath - Repository-relative path.
 * @returns Absolute path without duplicate slashes.
 */
function joinPath(dir: string, filepath: string): string {
  const base = dir === '/' ? '' : dir.replace(/\/+$/, '');
  return `${base}/${filepath.replace(/^\/+/, '')}`;
}

/**
 * Decode file contents read from a filesystem into a UTF-8 string.
 * @param data - Raw file contents.
 * @returns Decoded text.
 */
function decode(data: unknown): string {
  if (typeof data === 'string') {
    return data;
  }
  if (data instanceof Uint8Array) {
    return new TextDecoder().decode(data);
  }
  return String(data);
}

/**
 * Read every tracked working-tree file (excluding `.git`) as UTF-8 text.
 * @param fs - Isomorphic-git filesystem client.
 * @param dir - Repository directory.
 * @returns Map of repository-relative paths to file contents.
 */
export async function readWorkingFiles(
  fs: FsClient,
  dir: string,
): Promise<Map<string, string>> {
  const promises = getPromiseFs(fs);
  const filepaths = await git.listFiles({ fs, dir });
  const files = new Map<string, string>();

  for (const filepath of filepaths) {
    if (filepath === '.git' || filepath.startsWith('.git/')) {
      continue;
    }
    const data = await promises.readFile(joinPath(dir, filepath));
    files.set(filepath, decode(data));
  }

  return files;
}

/**
 * Create or check out a branch, write and remove files, stage and commit them.
 * Existing files not present in the map and not listed for removal are left untouched.
 * @param fs - Isomorphic-git filesystem client.
 * @param dir - Repository directory.
 * @param opts - Branch, files, removals, commit message and author.
 * @returns The new commit sha.
 */
export async function commitFilesOnBranch(
  fs: FsClient,
  dir: string,
  opts: CommitFilesOnBranchOptions,
): Promise<string> {
  const promises = getPromiseFs(fs);

  await git.branch({ fs, dir, ref: opts.branch, checkout: true });

  for (const [filepath, content] of opts.files) {
    const target = joinPath(dir, filepath);
    const parent = target.slice(0, target.lastIndexOf('/'));
    try {
      await promises.mkdir(parent, { recursive: true });
    } catch {
      // Parent directory already exists.
    }
    await promises.writeFile(target, content);
  }

  for (const filepath of opts.files.keys()) {
    await git.add({ fs, dir, filepath });
  }

  for (const filepath of opts.remove ?? []) {
    try {
      await promises.unlink(joinPath(dir, filepath));
    } catch {
      // Missing working-tree file: nothing to delete.
    }
    try {
      await git.remove({ fs, dir, filepath });
    } catch {
      // Missing or untracked file: nothing to stage as removed.
    }
  }

  return git.commit({
    fs,
    dir,
    message: opts.message,
    author: {
      name: opts.author.name,
      email: opts.author.email,
      timestamp: Math.floor(Date.now() / 1000),
      timezoneOffset: 0,
    },
  });
}

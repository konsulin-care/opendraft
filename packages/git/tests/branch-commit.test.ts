import { describe, it, expect } from 'vitest';
import git from 'isomorphic-git';
import { MemoryFS } from '../src/memory-fs.js';
import { commitFilesOnBranch, readWorkingFiles } from '../src/index.js';

const DIR = '/repo';
const AUTHOR = { name: 'Test Author', email: 'test@example.com' };

/**
 * Decode file contents from a git blob.
 * @param fs - Filesystem used by the repository.
 * @param oid - Tree oid or commit oid.
 * @param filepath - File path within the repository.
 * @returns UTF-8 decoded blob contents.
 */
async function readBlob(fs: MemoryFS, oid: string, filepath: string): Promise<string> {
  const { blob } = await git.readBlob({ fs, dir: DIR, oid, filepath });
  return new TextDecoder().decode(blob);
}

/**
 * Initialize a repository with one committed file.
 * @returns Filesystem with an initialized repository.
 */
async function initRepo(): Promise<MemoryFS> {
  const fs = new MemoryFS();
  await git.init({ fs, dir: DIR, defaultBranch: 'main' });
  await fs.promises.writeFile(`${DIR}/existing.txt`, 'keep me');
  await git.add({ fs, dir: DIR, filepath: 'existing.txt' });
  await git.commit({
    fs,
    dir: DIR,
    message: 'Initial commit',
    author: { ...AUTHOR, timestamp: Math.floor(Date.now() / 1000), timezoneOffset: 0 },
  });
  return fs;
}

describe('commitFilesOnBranch', () => {
  it('creates and checks out the branch with the given files, author and message', async () => {
    const fs = await initRepo();

    const sha = await commitFilesOnBranch(fs, DIR, {
      branch: 'opendraft/init',
      files: new Map([
        ['opendraft.yml', 'version: 1\n'],
        ['manuscripts/paper/index.qmd', '---\ntitle: Draft\n---\n'],
      ]),
      message: 'Scaffold OpenDraft',
      author: AUTHOR,
    });

    expect(await git.currentBranch({ fs, dir: DIR })).toBe('opendraft/init');
    expect(await git.resolveRef({ fs, dir: DIR, ref: 'HEAD' })).toBe(sha);

    const [entry] = await git.log({ fs, dir: DIR, depth: 1 });
    expect(entry.oid).toBe(sha);
    expect(entry.commit.message).toBe('Scaffold OpenDraft\n');
    expect(entry.commit.author.name).toBe(AUTHOR.name);
    expect(entry.commit.author.email).toBe(AUTHOR.email);

    expect(await readBlob(fs, sha, 'opendraft.yml')).toBe('version: 1\n');
    expect(await readBlob(fs, sha, 'manuscripts/paper/index.qmd')).toBe(
      '---\ntitle: Draft\n---\n',
    );
  });

  it('leaves existing files that are not in the map unchanged', async () => {
    const fs = await initRepo();

    const sha = await commitFilesOnBranch(fs, DIR, {
      branch: 'opendraft/init',
      files: new Map([['new.txt', 'new content']]),
      message: 'Add one file',
      author: AUTHOR,
    });

    expect(await readBlob(fs, sha, 'existing.txt')).toBe('keep me');
    expect(await readBlob(fs, sha, 'new.txt')).toBe('new content');
  });
});

describe('readWorkingFiles', () => {
  it('returns every working-tree file path and content excluding .git', async () => {
    const fs = await initRepo();
    await fs.promises.writeFile(`${DIR}/manuscripts/paper/index.qmd`, '# Draft');
    await git.add({ fs, dir: DIR, filepath: 'manuscripts/paper/index.qmd' });
    await git.commit({
      fs,
      dir: DIR,
      message: 'Add manuscript',
      author: { ...AUTHOR, timestamp: Math.floor(Date.now() / 1000), timezoneOffset: 0 },
    });

    const files = await readWorkingFiles(fs, DIR);

    expect([...files.keys()].sort()).toEqual([
      'existing.txt',
      'manuscripts/paper/index.qmd',
    ]);
    expect(files.get('existing.txt')).toBe('keep me');
    expect(files.get('manuscripts/paper/index.qmd')).toBe('# Draft');
    expect([...files.keys()].some((path) => path.startsWith('.git'))).toBe(false);
  });
});

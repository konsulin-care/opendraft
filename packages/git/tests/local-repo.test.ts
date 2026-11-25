import { describe, it, expect } from 'vitest';
import git from 'isomorphic-git';
import { MemoryFS } from '../src/memory-fs.js';
import { LocalRepo } from '../src/index.js';

const DIR = '/repo';
const AUTHOR = { name: 'Test Author', email: 'test@example.com' };

/**
 * Initialize a repository with two committed files.
 * @returns Filesystem and its LocalRepo handle.
 */
async function initRepo(): Promise<{ fs: MemoryFS; repo: LocalRepo }> {
  const fs = new MemoryFS();
  await git.init({ fs, dir: DIR, defaultBranch: 'main' });
  await fs.promises.writeFile(`${DIR}/existing.txt`, 'keep me');
  await fs.promises.writeFile(`${DIR}/obsolete.txt`, 'remove me');
  await git.add({
    fs,
    dir: DIR,
    filepath: ['existing.txt', 'obsolete.txt'],
  });
  await git.commit({
    fs,
    dir: DIR,
    message: 'Initial commit',
    author: {
      ...AUTHOR,
      timestamp: Math.floor(Date.now() / 1000),
      timezoneOffset: 0,
    },
  });
  return { fs, repo: new LocalRepo(fs, DIR) };
}

/**
 * Decode a blob from a commit.
 * @param fs - Filesystem used by the repository.
 * @param oid - Commit oid.
 * @param filepath - File path within the repository.
 * @returns UTF-8 decoded contents.
 */
async function readBlob(
  fs: MemoryFS,
  oid: string,
  filepath: string,
): Promise<string> {
  const { blob } = await git.readBlob({ fs, dir: DIR, oid, filepath });
  return new TextDecoder().decode(blob);
}

describe('LocalRepo.commitFiles', () => {
  it('writes and deletes worktree files and returns the new commit sha', async () => {
    const { fs, repo } = await initRepo();

    const sha = await repo.commitFiles(
      new Map<string, string | null>([
        ['existing.txt', 'changed'],
        ['nested/new.txt', 'new content'],
        ['obsolete.txt', null],
      ]),
      'Update files',
      AUTHOR,
    );

    expect(sha).toBeTruthy();
    expect(await git.resolveRef({ fs, dir: DIR, ref: 'HEAD' })).toBe(sha);
    expect(await readBlob(fs, sha!, 'existing.txt')).toBe('changed');
    expect(await readBlob(fs, sha!, 'nested/new.txt')).toBe('new content');
    await expect(readBlob(fs, sha!, 'obsolete.txt')).rejects.toThrow();
    await expect(fs.promises.readFile(`${DIR}/obsolete.txt`)).rejects.toThrow();
    expect(await fs.promises.readFile(`${DIR}/nested/new.txt`, { encoding: 'utf8' })).toBe(
      'new content',
    );

    const [entry] = await git.log({ fs, dir: DIR, depth: 1 });
    expect(entry.oid).toBe(sha);
    expect(entry.commit.message).toBe('Update files\n');
    expect(entry.commit.author.name).toBe(AUTHOR.name);
    expect(entry.commit.author.email).toBe(AUTHOR.email);
  });

  it('returns null when the requested files already match the commit', async () => {
    const { fs, repo } = await initRepo();
    const head = await git.resolveRef({ fs, dir: DIR, ref: 'HEAD' });

    const sha = await repo.commitFiles(
      new Map([['existing.txt', 'keep me']]),
      'No-op commit',
      AUTHOR,
    );

    expect(sha).toBeNull();
    expect(await git.resolveRef({ fs, dir: DIR, ref: 'HEAD' })).toBe(head);
    const history = await git.log({ fs, dir: DIR });
    expect(history).toHaveLength(1);
  });
});

describe('LocalRepo.unpushed', () => {
  it('returns local commits unreachable from the remote ref, oldest first', async () => {
    const { fs, repo } = await initRepo();
    await git.branch({ fs, dir: DIR, ref: 'origin/main' });

    const second = await repo.commitFiles(
      new Map([['existing.txt', 'second']]),
      'Second commit',
      AUTHOR,
    );
    const third = await repo.commitFiles(
      new Map([['third.txt', 'third']]),
      'Third commit',
      AUTHOR,
    );

    expect(await repo.unpushed('origin/main')).toEqual([second, third]);
  });
});

describe('LocalRepo.renameBranch', () => {
  it('renames the current branch and moves HEAD with it', async () => {
    const { fs, repo } = await initRepo();
    const head = await git.resolveRef({ fs, dir: DIR, ref: 'HEAD' });

    await repo.renameBranch('main', 'trunk');

    expect(await git.currentBranch({ fs, dir: DIR })).toBe('trunk');
    expect(await git.resolveRef({ fs, dir: DIR, ref: 'HEAD' })).toBe(head);
    expect(await git.resolveRef({ fs, dir: DIR, ref: 'trunk' })).toBe(head);
    await expect(
      git.resolveRef({ fs, dir: DIR, ref: 'main' }),
    ).rejects.toThrow();
  });
});

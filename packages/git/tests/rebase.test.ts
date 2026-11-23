import { describe, it, expect } from 'vitest';
import git from 'isomorphic-git';
import { MemoryFS } from '../src/memory-fs.js';
import { rebaseOnto } from '../src/index.js';

const DIR = '/repo';
const AUTHOR = {
  name: 'Test Author',
  email: 'test@example.com',
  timestamp: Math.floor(Date.now() / 1000),
  timezoneOffset: 0,
};

/**
 * Write files, stage them, and create a commit.
 * @param fs - In-memory repository filesystem.
 * @param files - Repository-relative paths mapped to contents.
 * @param message - Commit message.
 * @returns The new commit oid.
 */
async function commitFiles(
  fs: MemoryFS,
  files: Record<string, string>,
  message: string,
): Promise<string> {
  for (const [filepath, content] of Object.entries(files)) {
    await fs.promises.writeFile(`${DIR}/${filepath}`, content);
  }
  await git.add({ fs, dir: DIR, filepath: Object.keys(files) });
  return git.commit({ fs, dir: DIR, message, author: AUTHOR });
}

/**
 * Read a file from a commit.
 * @param fs - In-memory repository filesystem.
 * @param oid - Commit oid.
 * @param filepath - Repository-relative path.
 * @returns Decoded file contents.
 */
async function readBlob(
  fs: MemoryFS,
  oid: string,
  filepath: string,
): Promise<string> {
  const { blob } = await git.readBlob({ fs, dir: DIR, oid, filepath });
  return new TextDecoder().decode(blob);
}

/**
 * Initialize a repository with one commit on main.
 * @returns Filesystem and the base commit oid.
 */
async function initRepo(): Promise<{ fs: MemoryFS; base: string }> {
  const fs = new MemoryFS();
  await git.init({ fs, dir: DIR, defaultBranch: 'main' });
  const base = await commitFiles(fs, { 'base.txt': 'base' }, 'base commit');
  return { fs, base };
}

/**
 * Create feature and onto branches for a non-conflicting rebase.
 * @returns Filesystem, base oid, branch tips, and replayed oids.
 */
async function setupLinearRepo() {
  const { fs, base } = await initRepo();
  await git.branch({ fs, dir: DIR, ref: 'feature', object: base, checkout: true });
  const first = await commitFiles(fs, { 'one.txt': 'one' }, 'add one');
  const second = await commitFiles(fs, { 'two.txt': 'two' }, 'add two');
  const featureTip = await git.resolveRef({ fs, dir: DIR, ref: 'refs/heads/feature' });
  await git.branch({ fs, dir: DIR, ref: 'onto', object: base, checkout: true });
  await commitFiles(fs, { 'onto.txt': 'onto' }, 'add onto');
  const ontoTip = await git.resolveRef({ fs, dir: DIR, ref: 'refs/heads/onto' });
  return { fs, base, first, second, featureTip, ontoTip };
}

/**
 * Create feature and onto branches that both edit the same two files.
 * @returns Filesystem, base oid, and the original feature tip.
 */
async function setupConflictRepo() {
  const fs = new MemoryFS();
  await git.init({ fs, dir: DIR, defaultBranch: 'main' });
  const base = await commitFiles(
    fs,
    { 'a.txt': 'base a', 'b.txt': 'base b' },
    'base',
  );
  await git.branch({ fs, dir: DIR, ref: 'feature', object: base, checkout: true });
  await commitFiles(
    fs,
    { 'a.txt': 'feature a', 'b.txt': 'feature b', 'feature-only.txt': 'feature only' },
    'feature changes',
  );
  const featureTip = await git.resolveRef({ fs, dir: DIR, ref: 'refs/heads/feature' });
  await git.branch({ fs, dir: DIR, ref: 'onto', object: base, checkout: true });
  await commitFiles(fs, { 'a.txt': 'accepted a', 'b.txt': 'accepted b' }, 'accepted');
  return { fs, base, featureTip };
}

describe('rebaseOnto replay', () => {
  it('replays only commits after from onto onto in order', async () => {
    const { fs, base, first, second, featureTip, ontoTip } =
      await setupLinearRepo();

    const result = await rebaseOnto({
      fs,
      dir: DIR,
      branch: 'feature',
      onto: 'onto',
      from: base,
      resolve: () => ({}),
    });

    expect(result.tip).toBe(
      await git.resolveRef({ fs, dir: DIR, ref: 'refs/heads/feature' }),
    );
    expect(result.backup).toBe(featureTip);
    expect(
      await git.resolveRef({ fs, dir: DIR, ref: 'refs/od-backup/feature' }),
    ).toBe(featureTip);
    expect(await git.currentBranch({ fs, dir: DIR })).toBe('feature');
    expect(await fs.promises.readFile(`${DIR}/onto.txt`, { encoding: 'utf8' })).toBe('onto');

    const history = await git.log({ fs, dir: DIR, ref: 'feature' });
    expect(history.slice(0, 3).map((entry) => entry.commit.message.trim())).toEqual([
      'add two',
      'add one',
      'add onto',
    ]);
    expect(history[0].oid).not.toBe(second);
    expect(history[1].oid).not.toBe(first);
    expect(history[2].oid).toBe(ontoTip);
    expect(history[1].commit.parent).toEqual([ontoTip]);
    expect(history[0].commit.parent).toEqual([history[1].oid]);
    for (const filepath of ['base.txt', 'one.txt', 'two.txt', 'onto.txt']) {
      await expect(readBlob(fs, result.tip, filepath)).resolves.toBeTruthy();
    }
  });
});

describe('rebaseOnto conflicts', () => {
  it('passes conflicting paths to resolve and writes the chosen side', async () => {
    const { fs, base, featureTip } = await setupConflictRepo();
    const seen: string[][] = [];

    const result = await rebaseOnto({
      fs,
      dir: DIR,
      branch: 'feature',
      onto: 'onto',
      from: base,
      resolve: (paths) => {
        seen.push(paths);
        return { 'a.txt': 'mine', 'b.txt': 'theirs' };
      },
    });

    expect(seen).toHaveLength(1);
    expect(seen[0]).toEqual(expect.arrayContaining(['a.txt', 'b.txt']));
    expect(await readBlob(fs, result.tip, 'a.txt')).toBe('feature a');
    expect(await readBlob(fs, result.tip, 'b.txt')).toBe('accepted b');
    expect(await readBlob(fs, result.tip, 'feature-only.txt')).toBe('feature only');
    expect(result.backup).toBe(featureTip);
    expect(
      await git.resolveRef({ fs, dir: DIR, ref: 'refs/od-backup/feature' }),
    ).toBe(featureTip);
  });
});

describe('rebaseOnto failure', () => {
  it('restores the branch tip when the rebase fails', async () => {
    const { fs, base } = await initRepo();
    await git.branch({ fs, dir: DIR, ref: 'feature', object: base, checkout: true });
    await commitFiles(fs, { 'base.txt': 'feature' }, 'feature change');
    const featureTip = await git.resolveRef({ fs, dir: DIR, ref: 'refs/heads/feature' });
    await git.branch({ fs, dir: DIR, ref: 'onto', object: base, checkout: true });
    await commitFiles(fs, { 'base.txt': 'onto' }, 'onto change');

    await expect(
      rebaseOnto({
        fs,
        dir: DIR,
        branch: 'feature',
        onto: 'onto',
        from: base,
        resolve: () => {
          throw new Error('cannot resolve');
        },
      }),
    ).rejects.toThrow('cannot resolve');

    expect(
      await git.resolveRef({ fs, dir: DIR, ref: 'refs/heads/feature' }),
    ).toBe(featureTip);
    expect(
      await git.resolveRef({ fs, dir: DIR, ref: 'refs/od-backup/feature' }),
    ).toBe(featureTip);
    expect(await git.currentBranch({ fs, dir: DIR })).toBe('feature');
    expect(await fs.promises.readFile(`${DIR}/base.txt`, { encoding: 'utf8' })).toBe('feature');
  });
});

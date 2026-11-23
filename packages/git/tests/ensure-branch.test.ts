import { describe, it, expect } from 'vitest';
import git from 'isomorphic-git';
import { MemoryFS } from '../src/memory-fs.js';
import { ensureBranch } from '../src/index.js';

const DIR = '/repo';
const AUTHOR = { name: 'Test Author', email: 'test@example.com' };

/**
 * Initialize a repository with one committed file on `main`.
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

describe('ensureBranch', () => {
  it('creates a missing branch at the current HEAD commit and checks it out', async () => {
    const fs = await initRepo();
    const head = await git.resolveRef({ fs, dir: DIR, ref: 'HEAD' });

    const result = await ensureBranch(fs, DIR, 'opendraft/lamurian/draft');

    expect(result).toBe('opendraft/lamurian/draft');
    expect(await git.currentBranch({ fs, dir: DIR })).toBe('opendraft/lamurian/draft');
    expect(await git.resolveRef({ fs, dir: DIR, ref: 'opendraft/lamurian/draft' })).toBe(head);
    expect(await git.resolveRef({ fs, dir: DIR, ref: 'HEAD' })).toBe(head);
    expect(await git.listBranches({ fs, dir: DIR })).toContain('opendraft/lamurian/draft');
  });

  it('checks out an existing non-current branch without moving its commit', async () => {
    const fs = await initRepo();
    await git.branch({ fs, dir: DIR, ref: 'opendraft/other' });
    const otherHead = await git.resolveRef({ fs, dir: DIR, ref: 'opendraft/other' });
    await git.checkout({ fs, dir: DIR, ref: 'main' });
    expect(await git.currentBranch({ fs, dir: DIR })).toBe('main');

    const result = await ensureBranch(fs, DIR, 'opendraft/other');

    expect(result).toBe('opendraft/other');
    expect(await git.currentBranch({ fs, dir: DIR })).toBe('opendraft/other');
    expect(await git.resolveRef({ fs, dir: DIR, ref: 'opendraft/other' })).toBe(otherHead);
  });

  it('leaves the repository unchanged when the branch is already checked out', async () => {
    const fs = await initRepo();
    await ensureBranch(fs, DIR, 'opendraft/same');
    const head = await git.resolveRef({ fs, dir: DIR, ref: 'HEAD' });

    const result = await ensureBranch(fs, DIR, 'opendraft/same');

    expect(result).toBe('opendraft/same');
    expect(await git.currentBranch({ fs, dir: DIR })).toBe('opendraft/same');
    expect(await git.resolveRef({ fs, dir: DIR, ref: 'HEAD' })).toBe(head);
  });
});

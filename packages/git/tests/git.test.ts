import { describe, it, expect, beforeEach } from 'vitest';
import git from 'isomorphic-git';
import { MemoryFS } from '../src/memory-fs.js';

describe('GitOperations with MemoryFS', () => {
  let fs: MemoryFS;
  const dir = '/repo';

  beforeEach(() => {
    fs = new MemoryFS();
  });

  it('initializes a new repository', async () => {
    await git.init({ fs, dir });
    const head = await git.resolveRef({ fs, dir, ref: 'HEAD' }).catch(() => null);
    expect(head === null || typeof head === 'string').toBe(true);
  });

  it('commits files to the repository', async () => {
    await git.init({ fs, dir });
    await fs.promises.writeFile(`${dir}/test.txt`, 'hello world');
    await git.add({ fs, dir, filepath: 'test.txt' });

    const sha = await git.commit({
      fs,
      dir,
      message: 'Initial commit',
      author: { name: 'Test', email: 'test@example.com', timestamp: Date.now(), timezoneOffset: 0 },
    });

    expect(sha).toBeDefined();
    expect(sha.length).toBe(40);
  });

  it('shows file status changes', async () => {
    await git.init({ fs, dir });
    await fs.promises.writeFile(`${dir}/test.txt`, 'hello');

    const statusMatrix = await git.statusMatrix({ fs, dir });
    expect(statusMatrix).toHaveLength(1);
    expect(statusMatrix[0][0]).toBe('test.txt');
    expect(statusMatrix[0][2]).toBe(2); // workdirStatus: new
  });
});

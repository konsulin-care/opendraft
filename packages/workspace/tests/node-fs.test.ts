import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import * as browserIndex from '../src/index.js';
import { NodeFsWorkspace } from '../src/node-fs.js';

/**
 * Create a throwaway workspace under a fresh temp sandbox.
 * @returns The sandbox path (for cleanup) and the workspace under test.
 */
async function createSandbox(): Promise<{
  sandbox: string;
  workspace: NodeFsWorkspace;
}> {
  const sandbox = await mkdtemp(path.join(tmpdir(), 'opendraft-node-fs-'));
  const root = path.join(sandbox, 'workspace');
  return { sandbox, workspace: new NodeFsWorkspace(root) };
}

/** Per-test sandbox state shared by each workspace describe block. */
interface SandboxState {
  sandbox: string;
  workspace: NodeFsWorkspace;
}

/**
 * Install beforeEach/afterEach hooks that provide a fresh workspace per test.
 * @returns A mutable reference to the current test's sandbox state.
 */
function useSandbox(): () => SandboxState {
  let state: SandboxState | undefined;
  beforeEach(async () => {
    state = await createSandbox();
  });
  afterEach(async () => {
    if (state) await rm(state.sandbox, { recursive: true, force: true });
  });
  return () => {
    if (!state) throw new Error('sandbox not initialised');
    return state;
  };
}

describe('entry points', () => {
  it('exports NodeFsWorkspace via ./node, not from the browser index', async () => {
    const pkg = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { exports: Record<string, string> };
    expect(pkg.exports['./node']).toBe('./src/node-fs.ts');
    expect('NodeFsWorkspace' in browserIndex).toBe(false);
  });
});

describe('NodeFsWorkspace readFile / writeFile', () => {
  const getSandbox = useSandbox();

  it('returns null for a missing file', async () => {
    const { workspace } = getSandbox();
    const content = await workspace.readFile('missing.txt');
    expect(content).toBeNull();
  });

  it('creates parent directories and round-trips content', async () => {
    const { workspace } = getSandbox();
    await workspace.writeFile('docs/nested/deep/file.md', '# hello');
    const content = await workspace.readFile('docs/nested/deep/file.md');
    expect(content).toBe('# hello');
  });

  it('overwrites existing file content', async () => {
    const { workspace } = getSandbox();
    await workspace.writeFile('file.txt', 'first');
    await workspace.writeFile('file.txt', 'second');
    expect(await workspace.readFile('file.txt')).toBe('second');
  });
});

describe('NodeFsWorkspace listFiles', () => {
  const getSandbox = useSandbox();

  it('returns basenames of direct children', async () => {
    const { workspace } = getSandbox();
    await workspace.writeFile('docs/a.md', 'a');
    await workspace.writeFile('docs/b.md', 'b');
    await workspace.writeFile('docs/sub/c.md', 'c');

    const files = await workspace.listFiles('docs');
    expect([...files].sort()).toEqual(['a.md', 'b.md']);
  });

  it('returns [] for a missing directory', async () => {
    const { workspace } = getSandbox();
    const files = await workspace.listFiles('does-not-exist');
    expect(files).toEqual([]);
  });
});

describe('NodeFsWorkspace listAll', () => {
  const getSandbox = useSandbox();

  it('includes nested files as root-relative paths', async () => {
    const { workspace } = getSandbox();
    await workspace.writeFile('a.md', 'a');
    await workspace.writeFile('dir/sub/b.bib', 'b');

    const files = await workspace.listAll();
    expect(files).toEqual(['a.md', 'dir/sub/b.bib']);
  });

  it('returns [] when the root directory does not exist', async () => {
    const { workspace } = getSandbox();
    expect(await workspace.listAll()).toEqual([]);
  });
});

describe('NodeFsWorkspace deleteFile', () => {
  const getSandbox = useSandbox();

  it('removes the file', async () => {
    const { workspace } = getSandbox();
    await workspace.writeFile('gone.txt', 'bye');
    await workspace.deleteFile('gone.txt');
    expect(await workspace.readFile('gone.txt')).toBeNull();
  });

  it('does not throw for a missing file', async () => {
    const { workspace } = getSandbox();
    await expect(workspace.deleteFile('missing.txt')).resolves.toBeUndefined();
  });

  it('rejects a path resolving outside the root', async () => {
    const { sandbox, workspace } = getSandbox();
    const outsideFile = path.join(sandbox, 'secret.txt');
    await writeFile(outsideFile, 'secret');

    await expect(workspace.deleteFile('../secret.txt')).rejects.toThrow();
    expect(await readFile(outsideFile, 'utf8')).toBe('secret');
  });

  it('rejects an absolute path outside the root', async () => {
    const { sandbox, workspace } = getSandbox();
    const outsideFile = path.join(sandbox, 'secret.txt');
    await writeFile(outsideFile, 'secret');

    await expect(workspace.readFile(outsideFile)).rejects.toThrow();
    expect(await readFile(outsideFile, 'utf8')).toBe('secret');
  });
});

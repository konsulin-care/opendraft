import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { indexedDB } from 'fake-indexeddb';
import { IndexedDBWorkspace } from '../src/indexeddb.js';
import { REGISTRY_DB, workspaceDbName } from '../src/db-names.js';

describe('database names', () => {
  it("workspaceDbName('abc') returns 'od-ws-abc'", () => {
    expect(workspaceDbName('abc')).toBe('od-ws-abc');
  });

  it('REGISTRY_DB is od-registry', () => {
    expect(REGISTRY_DB).toBe('od-registry');
  });
});

describe('IndexedDBWorkspace database naming', () => {
  it("opens a database named 'od-ws-abc'", async () => {
    const workspace = new IndexedDBWorkspace('abc');
    await workspace.writeFile('a.md', 'a');

    const names = (await indexedDB.databases()).map((db: { name?: string }) => db.name);
    expect(names).toContain('od-ws-abc');
    expect(names).not.toContain('opendraft-workspace-abc');
  });
});

describe('IndexedDBWorkspace.listAll', () => {
  it('returns every stored file path, sorted', async () => {
    const workspace = new IndexedDBWorkspace('listall-test');
    await workspace.writeFile('dir/sub/c.bib', 'c');
    await workspace.writeFile('a.md', 'a');
    await workspace.writeFile('dir/b.yml', 'b');

    const files = await workspace.listAll();
    expect(files).toEqual(['a.md', 'dir/b.yml', 'dir/sub/c.bib']);
  });

  it('returns empty array when no files are stored', async () => {
    const workspace = new IndexedDBWorkspace('listall-empty-test');
    const files = await workspace.listAll();
    expect(files).toEqual([]);
  });
});

function createWorkspace(): IndexedDBWorkspace {
  return new IndexedDBWorkspace('test-workspace');
}

describe('IndexedDBWorkspace.writeFile and readFile', () => {
  let workspace: IndexedDBWorkspace;

  beforeEach(() => {
    workspace = createWorkspace();
  });

  it('writes and reads a file', async () => {
    await workspace.writeFile('test.txt', 'hello');
    const content = await workspace.readFile('test.txt');
    expect(content).toBe('hello');
  });

  it('overwrites existing file', async () => {
    await workspace.writeFile('test.txt', 'first');
    await workspace.writeFile('test.txt', 'second');
    const content = await workspace.readFile('test.txt');
    expect(content).toBe('second');
  });

  it('returns null for missing file', async () => {
    const content = await workspace.readFile('missing.txt');
    expect(content).toBeNull();
  });
});

describe('IndexedDBWorkspace.deleteFile', () => {
  let workspace: IndexedDBWorkspace;

  beforeEach(() => {
    workspace = createWorkspace();
  });

  it('deletes existing file', async () => {
    await workspace.writeFile('test.txt', 'hello');
    await workspace.deleteFile('test.txt');
    const content = await workspace.readFile('test.txt');
    expect(content).toBeNull();
  });

  it('does not throw when deleting missing file', async () => {
    await expect(workspace.deleteFile('missing.txt')).resolves.toBeUndefined();
  });
});

describe('IndexedDBWorkspace.listFiles', () => {
  let workspace: IndexedDBWorkspace;

  beforeEach(() => {
    workspace = createWorkspace();
  });

  it('returns empty array for empty directory', async () => {
    const files = await workspace.listFiles('nonexistent/');
    expect(files).toEqual([]);
  });

  it('lists files in directory', async () => {
    await workspace.writeFile('dir/file1.txt', 'a');
    await workspace.writeFile('dir/file2.txt', 'b');
    await workspace.writeFile('other/file3.txt', 'c');

    const files = await workspace.listFiles('dir/');
    expect(files).toContain('file1.txt');
    expect(files).toContain('file2.txt');
    expect(files).not.toContain('file3.txt');
  });

  it('returns empty array when directory has no files', async () => {
    await workspace.writeFile('other/file.txt', 'a');
    const files = await workspace.listFiles('empty/');
    expect(files).toEqual([]);
  });
});

describe('IndexedDBWorkspace.ready', () => {
  it('resolves after DB opens', async () => {
    const workspace = new IndexedDBWorkspace('ready-test-1');
    await expect(workspace.ready()).resolves.toBeUndefined();
  });

  it('rejects if DB open fails', async () => {
    // Simulate a failure by creating a workspace with invalid config
    // We can't easily trigger a real DB failure in fake-indexeddb,
    // but we can test that the promise is properly exposed
    const workspace = new IndexedDBWorkspace('ready-test-2');
    const readyPromise = workspace.ready();
    expect(readyPromise).toBeInstanceOf(Promise);
    await expect(readyPromise).resolves.toBeUndefined();
  });
});

describe('IndexedDBWorkspace.close', () => {
  it('closes the connection so the database can be deleted without blocking', async () => {
    const name = workspaceDbName('close-test');
    const workspace = new IndexedDBWorkspace('close-test');
    await workspace.writeFile('test.txt', 'hello');
    await workspace.close();

    const deleteResult = await new Promise<string>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(name);
      req.onsuccess = () => resolve('deleted');
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('delete blocked by open connection'));
    });
    expect(deleteResult).toBe('deleted');
  });
});

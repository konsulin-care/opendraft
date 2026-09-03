import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { indexedDB } from 'fake-indexeddb';
import { IndexedDBWorkspace } from '../src/indexeddb.js';

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

describe('IndexedDBWorkspace.close', () => {
  it('closes the connection so the database can be deleted without blocking', async () => {
    const name = 'opendraft-workspace-close-test';
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

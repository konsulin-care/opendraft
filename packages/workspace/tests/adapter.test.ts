import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryWorkspace } from '../src/memory.js';

describe('MemoryWorkspace', () => {
  let workspace: MemoryWorkspace;

  beforeEach(() => {
    workspace = new MemoryWorkspace();
  });

  describe('writeFile', () => {
    it('creates a new file', async () => {
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
  });

  describe('readFile', () => {
    it('returns null for missing file', async () => {
      const content = await workspace.readFile('missing.txt');
      expect(content).toBeNull();
    });

    it('returns file content', async () => {
      await workspace.writeFile('test.txt', 'hello');
      const content = await workspace.readFile('test.txt');
      expect(content).toBe('hello');
    });
  });

  describe('deleteFile', () => {
    it('removes existing file', async () => {
      await workspace.writeFile('test.txt', 'hello');
      await workspace.deleteFile('test.txt');
      const content = await workspace.readFile('test.txt');
      expect(content).toBeNull();
    });

    it('does not throw for missing file', async () => {
      await expect(workspace.deleteFile('missing.txt')).resolves.toBeUndefined();
    });
  });
});

describe('MemoryWorkspace.listFiles', () => {
  let workspace: MemoryWorkspace;

  beforeEach(() => {
    workspace = new MemoryWorkspace();
  });

  it('returns empty array for empty directory', async () => {
    const files = await workspace.listFiles('nonexistent/');
    expect(files).toEqual([]);
  });

  it('returns files in directory', async () => {
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

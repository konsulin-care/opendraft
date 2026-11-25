import { describe, expect, it } from 'vitest';
import { MemoryWorkspace } from '../src/memory.js';
import { readOnlyWorkspace } from '../src/read-only.js';

describe('readOnlyWorkspace', () => {
  it('forwards readFile, listFiles and listAll results', async () => {
    const inner = new MemoryWorkspace();
    await inner.writeFile('a/b.txt', 'hello');
    await inner.writeFile('a/c.txt', 'world');
    const ws = readOnlyWorkspace(inner);

    expect(await ws.readFile('a/b.txt')).toBe('hello');
    expect(await ws.readFile('missing.txt')).toBeNull();
    expect(await ws.listFiles('a')).toEqual(await inner.listFiles('a'));
    expect(await ws.listAll()).toEqual(await inner.listAll());
  });

  it('rejects writeFile and deleteFile with read-only workspace', async () => {
    const inner = new MemoryWorkspace();
    await inner.writeFile('a/b.txt', 'hello');
    const ws = readOnlyWorkspace(inner);

    await expect(ws.writeFile('a/b.txt', 'changed')).rejects.toThrow('read-only workspace');
    await expect(ws.writeFile('new.txt', 'new')).rejects.toThrow('read-only workspace');
    await expect(ws.deleteFile('a/b.txt')).rejects.toThrow('read-only workspace');

    expect(await inner.readFile('a/b.txt')).toBe('hello');
    expect(await inner.readFile('new.txt')).toBeNull();
    expect(await inner.listAll()).toEqual(['a/b.txt']);
  });
});

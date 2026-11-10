import { describe, expect, it, vi } from 'vitest';
import { MemoryWorkspace } from '../src/memory.js';
import { withLogging } from '../src/logging.js';

describe('withLogging', () => {
  it('forwards every call and returns results unchanged', async () => {
    const inner = new MemoryWorkspace();
    const ws = withLogging(inner, { debug: () => {} });
    await ws.writeFile('a/b.txt', 'hello');
    expect(await ws.readFile('a/b.txt')).toBe('hello');
    expect(await ws.listFiles('a')).toEqual(await inner.listFiles('a'));
    expect(await ws.listAll()).toEqual(await inner.listAll());
    await ws.deleteFile('a/b.txt');
    expect(await inner.readFile('a/b.txt')).toBeNull();
  });

  it('logs writeFile and deleteFile with path and length', async () => {
    const debug = vi.fn();
    const ws = withLogging(new MemoryWorkspace(), { debug });
    await ws.writeFile('x.md', 'abc');
    await ws.deleteFile('x.md');
    await ws.readFile('x.md');
    expect(debug).toHaveBeenCalledTimes(2);
    expect(debug).toHaveBeenNthCalledWith(1, '[workspace] writeFile', 'x.md', 3);
    expect(debug).toHaveBeenNthCalledWith(2, '[workspace] deleteFile', 'x.md');
  });
});

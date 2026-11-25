/**
 * Buffer polyfill tests: the browser has no global `Buffer`, so the module
 * installs the `buffer` package implementation at load time and must never
 * replace a host-provided one.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Buffer as BufferImpl } from 'buffer';
import { ensureBuffer } from './buffer-polyfill';

describe('ensureBuffer', () => {
  let original: unknown;

  beforeEach(() => {
    original = (globalThis as { Buffer?: unknown }).Buffer;
  });

  afterEach(() => {
    (globalThis as { Buffer?: unknown }).Buffer = original;
  });

  it('defines globalThis.Buffer with a working Buffer.from when missing', () => {
    delete (globalThis as { Buffer?: unknown }).Buffer;

    ensureBuffer();

    const installed = (globalThis as { Buffer?: typeof BufferImpl }).Buffer;
    expect(installed).toBeDefined();
    expect(installed?.from('opendraft').toString('utf8')).toBe('opendraft');
    expect(installed?.from([1, 2, 3]).length).toBe(3);
  });

  it('leaves an existing globalThis.Buffer untouched', () => {
    const sentinel = { marker: 'keep-me' };
    (globalThis as { Buffer?: unknown }).Buffer = sentinel;

    ensureBuffer();

    expect((globalThis as { Buffer?: unknown }).Buffer).toBe(sentinel);
  });
});

/**
 * Browser Buffer polyfill.
 *
 * isomorphic-git references the global `Buffer` without importing it. Browsers
 * do not provide one, so this module installs the `buffer` package
 * implementation on `globalThis` — but only when the host has none.
 */
import { Buffer } from 'buffer';

/**
 * Installs the `buffer` package on `globalThis` when `globalThis.Buffer` is
 * missing. Existing host implementations, such as Node's, are left untouched.
 *
 * @returns Nothing; the global is assigned as a side effect when absent.
 */
export function ensureBuffer(): void {
  const target = globalThis as { Buffer?: typeof Buffer };
  if (target.Buffer === undefined) {
    target.Buffer = Buffer;
  }
}

ensureBuffer();

import type { WorkspaceAdapter } from './adapter.js';

/** Error message raised by every mutating call on a read-only workspace. */
const READ_ONLY_ERROR = 'read-only workspace';

/**
 * Wrap a workspace adapter so it can only be read.
 *
 * Reads are forwarded to the inner adapter; writes and deletes reject
 * without touching the inner adapter.
 *
 * @param inner - Adapter to forward read calls to.
 * @returns Adapter exposing readFile/listFiles/listAll only.
 */
export function readOnlyWorkspace(inner: WorkspaceAdapter): WorkspaceAdapter {
  return {
    readFile: (path) => inner.readFile(path),
    writeFile: async () => {
      throw new Error(READ_ONLY_ERROR);
    },
    deleteFile: async () => {
      throw new Error(READ_ONLY_ERROR);
    },
    listFiles: (dir) => inner.listFiles(dir),
    listAll: () => inner.listAll(),
  };
}

import { describe, it, expect, vi } from 'vitest';
import type { Mock } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { useBinaryPaths } from './use-file-tree-navigation';

// @vitest-environment jsdom

/** Paths long enough that classification is still running when we unmount. */
const PATHS = ['manuscripts/p/article.qmd', 'manuscripts/p/refs.bib', 'opendraft.yml'];

/** A readFile promise the test settles by hand. */
interface PendingRead {
  /** Resolve the read with file content (or null for a missing file). */
  resolve: (value: string | null) => void;
  /** Reject the read, as a workspace closed after unmount does. */
  reject: (error: unknown) => void;
}

/**
 * Build a workspace whose readFile calls stay pending until the test
 * resolves or rejects them, mirroring an IndexedDB workspace whose
 * database closes mid-classification.
 *
 * @returns The adapter passed to the hook plus handles to its pending reads.
 */
function makeControlledWorkspace(): {
  /** Adapter handed to the hook under test. */
  workspace: WorkspaceAdapter;
  /** Spy recording every readFile invocation. */
  readFile: Mock<() => Promise<string | null>>;
  /** Settle the pending read at the given call index. */
  resolveAt: (index: number, value: string | null) => void;
  /** Reject the pending read at the given call index. */
  rejectAt: (index: number, error: unknown) => void;
} {
  const pending: PendingRead[] = [];
  const readFile = vi.fn(
    (): Promise<string | null> =>
      new Promise<string | null>((resolve, reject) => {
        pending.push({ resolve, reject });
      }),
  );
  const workspace: WorkspaceAdapter = {
    readFile,
    writeFile: async () => {},
    deleteFile: async () => {},
    listFiles: async () => [],
    listAll: async () => [],
  };
  return {
    workspace,
    readFile,
    resolveAt: (index, value) => pending[index].resolve(value),
    rejectAt: (index, error) => pending[index].reject(error),
  };
}

/**
 * Flush microtasks and two event-loop turns so the fire-and-forget
 * classification loop settles after unmount.
 *
 * @returns Resolves once pending continuations have run.
 */
async function flushLoop(): Promise<void> {
  for (let i = 0; i < 2; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe('useBinaryPaths unmount guards', () => {
  it('stops calling readFile once the hook unmounts mid-classification', async () => {
    const { workspace, readFile, resolveAt } = makeControlledWorkspace();
    const { unmount } = renderHook(() => useBinaryPaths(PATHS, workspace));
    expect(readFile).toHaveBeenCalledTimes(1);

    unmount();
    resolveAt(0, 'content of the first path');
    await flushLoop();

    expect(readFile).toHaveBeenCalledTimes(1);
  });

  it('swallows a readFile rejection that lands after unmount', async () => {
    const { workspace, readFile, rejectAt } = makeControlledWorkspace();
    const { unmount } = renderHook(() => useBinaryPaths(PATHS, workspace));
    expect(readFile).toHaveBeenCalledTimes(1);

    unmount();
    rejectAt(0, new DOMException('The database connection is closing', 'InvalidStateError'));
    await flushLoop();

    // The rejection must not escape the void classification promise:
    // without a catch, vitest fails this file with "Unhandled Errors".
    expect(readFile).toHaveBeenCalledTimes(1);
  });
});

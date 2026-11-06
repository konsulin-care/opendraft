import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { workspaceManager, type IndexedDBWorkspace } from '@opendraft/workspace';
import { projectRegistry } from './useProjects';
import { useActiveFile } from './useActiveFile';
import { scaffoldProject } from '../project/scaffold';

// @vitest-environment jsdom

const BIB_PATH = 'manuscripts/p/references.bib';
const DIR_PATH = 'manuscripts/p';

let projectId: string;
let ws: IndexedDBWorkspace;

/** Remove every registry project and clear localStorage. */
async function resetRegistry(): Promise<void> {
  for (const record of await projectRegistry.list()) {
    await projectRegistry.remove(record.id);
  }
  localStorage.clear();
}

beforeEach(async () => {
  await resetRegistry();
  const record = await projectRegistry.create('Paper');
  projectId = record.id;
  ws = await workspaceManager.get(projectId);
  await scaffoldProject(ws, { manuscriptId: 'p' });
});

afterEach(async () => {
  workspaceManager.release(projectId);
  await resetRegistry();
});

/** openFile accepts a manuscript directory and persists it as the last path. */
async function expectOpenDirectoryPersists(): Promise<void> {
  const { result, unmount } = renderHook(() => useActiveFile(ws, projectId));
  await waitFor(() => expect(result.current.activePath).toBe(DIR_PATH));

  await act(async () => {
    await result.current.openFile('manuscripts/p/blocks');
  });

  expect(result.current.activePath).toBe('manuscripts/p/blocks');
  expect(await projectRegistry.getLastPath(projectId)).toBe('manuscripts/p/blocks');
  unmount();
}

/** Reopening a file before unmount is remembered across a remount. */
async function expectReopensStoredLastPath(): Promise<void> {
  const first = renderHook(() => useActiveFile(ws, projectId));
  await waitFor(() => expect(first.result.current.activePath).toBe(DIR_PATH));
  await act(async () => {
    await first.result.current.openFile(BIB_PATH);
  });
  first.unmount();

  const second = renderHook(() => useActiveFile(ws, projectId));
  await waitFor(() => expect(second.result.current.activePath).toBe(BIB_PATH));
  second.unmount();
}

describe('useActiveFile', () => {
  it('falls back to the manuscript directory when no last path is stored', async () => {
    const { result, unmount } = renderHook(() => useActiveFile(ws, projectId));
    await waitFor(() => expect(result.current.activePath).toBe(DIR_PATH));
    unmount();
  });

  it('openFile activates a path and persists it as the project last path', async () => {
    const { result, unmount } = renderHook(() => useActiveFile(ws, projectId));
    await waitFor(() => expect(result.current.activePath).toBe(DIR_PATH));

    await act(async () => {
      await result.current.openFile(BIB_PATH);
    });

    expect(result.current.activePath).toBe(BIB_PATH);
    expect(await projectRegistry.getLastPath(projectId)).toBe(BIB_PATH);
    unmount();
  });

  it('openFile accepts a manuscript directory and persists it', async () => {
    await expectOpenDirectoryPersists();
  });

  it('reopens the stored last path after a remount', async () => {
    await expectReopensStoredLastPath();
  });

  it('reopens a stored directory last path after a remount', async () => {
    await projectRegistry.setLastPath(projectId, DIR_PATH);
    const { result, unmount } = renderHook(() => useActiveFile(ws, projectId));
    await waitFor(() => expect(result.current.activePath).toBe(DIR_PATH));
    unmount();
  });

  it('falls back to the manuscript directory when the stored last path is gone', async () => {
    await projectRegistry.setLastPath(projectId, 'manuscripts/p/missing.qmd');
    const { result, unmount } = renderHook(() => useActiveFile(ws, projectId));
    await waitFor(() => expect(result.current.activePath).toBe(DIR_PATH));
    unmount();
  });
});

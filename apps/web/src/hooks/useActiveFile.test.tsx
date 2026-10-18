import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { workspaceManager, type IndexedDBWorkspace } from '@opendraft/workspace';
import { projectRegistry } from './useProjects';
import { useActiveFile } from './useActiveFile';
import { scaffoldProject } from '../project/scaffold';

// @vitest-environment jsdom

const ARTICLE_PATH = 'manuscripts/p/article.qmd';
const BIB_PATH = 'manuscripts/p/references.bib';

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

describe('useActiveFile', () => {
  it('resolves the manuscript article when no last path is stored', async () => {
    const { result, unmount } = renderHook(() => useActiveFile(ws, projectId));
    await waitFor(() => expect(result.current.activePath).toBe(ARTICLE_PATH));
    unmount();
  });

  it('openFile activates a path and persists it as the project last path', async () => {
    const { result, unmount } = renderHook(() => useActiveFile(ws, projectId));
    await waitFor(() => expect(result.current.activePath).toBe(ARTICLE_PATH));

    await act(async () => {
      await result.current.openFile(BIB_PATH);
    });

    expect(result.current.activePath).toBe(BIB_PATH);
    expect(await projectRegistry.getLastPath(projectId)).toBe(BIB_PATH);
    unmount();
  });

  it('reopens the stored last path after a remount', async () => {
    const first = renderHook(() => useActiveFile(ws, projectId));
    await waitFor(() => expect(first.result.current.activePath).toBe(ARTICLE_PATH));
    await act(async () => {
      await first.result.current.openFile(BIB_PATH);
    });
    first.unmount();

    const second = renderHook(() => useActiveFile(ws, projectId));
    await waitFor(() => expect(second.result.current.activePath).toBe(BIB_PATH));
    second.unmount();
  });

  it('falls back to the article when the stored last path no longer exists', async () => {
    await projectRegistry.setLastPath(projectId, 'manuscripts/p/missing.qmd');
    const { result, unmount } = renderHook(() => useActiveFile(ws, projectId));
    await waitFor(() => expect(result.current.activePath).toBe(ARTICLE_PATH));
    unmount();
  });
});

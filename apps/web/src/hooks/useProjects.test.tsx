import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { workspaceManager } from '@opendraft/workspace';
import { useProjects, projectRegistry, ACTIVE_PROJECT_KEY } from './useProjects';

// @vitest-environment jsdom

/**
 * Reset the shared registry to an empty state: remove every project
 * (which also destroys its workspace database) and clear localStorage,
 * so each test boots the hook against a fresh, empty IndexedDB.
 */
async function resetRegistry(): Promise<void> {
  for (const record of await projectRegistry.list()) {
    await projectRegistry.remove(record.id);
  }
  localStorage.clear();
}

/**
 * Render {@link useProjects} and wait for the registry boot to finish.
 *
 * @returns The renderHook result, with loading already false.
 */
async function bootProjects() {
  const rendered = renderHook(() => useProjects());
  await waitFor(() => expect(rendered.result.current.loading).toBe(false), { timeout: 10000 });
  return rendered;
}

/**
 * Assert that a project's workspace database holds the scaffolded files
 * for its manuscript.
 *
 * @param projectId - Id of the project whose workspace is inspected.
 * @param manuscriptId - Manuscript id the project was scaffolded with.
 */
async function expectScaffolded(projectId: string, manuscriptId: string): Promise<void> {
  const ws = await workspaceManager.get(projectId);
  try {
    expect(await ws.readFile('opendraft.yml')).not.toBeNull();
    expect(await ws.readFile(`manuscripts/${manuscriptId}/article.qmd`)).not.toBeNull();
    expect(await ws.readFile(`manuscripts/${manuscriptId}/references.bib`)).not.toBeNull();
  } finally {
    workspaceManager.release(projectId);
  }
}

beforeEach(async () => {
  await resetRegistry();
});

describe('useProjects boot', () => {
  it('auto-creates and scaffolds one "Untitled project" on an empty registry', async () => {
    const { result } = await bootProjects();

    expect(result.current.active?.name).toBe('Untitled project');
    expect(localStorage.getItem(ACTIVE_PROJECT_KEY)).toBe(result.current.active?.id);

    const records = await projectRegistry.list();
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe('Untitled project');

    const dbNames = (await indexedDB.databases()).map((db) => db.name);
    expect(dbNames).toContain('od-registry');
    expect(dbNames).toContain(`od-ws-${records[0].id}`);

    const ws = result.current.workspace;
    expect(ws).not.toBeNull();
    expect(await ws!.readFile('opendraft.yml')).not.toBeNull();
    expect(await ws!.readFile('manuscripts/untitled-project/article.qmd')).not.toBeNull();
  });
});

describe('useProjects mutations', () => {
  it('create() registers a project, scaffolds its workspace, and switches to it', async () => {
    const { result } = await bootProjects();

    let created: Awaited<ReturnType<typeof result.current.create>>;
    await act(async () => {
      created = await result.current.create('My Paper', 'my-paper');
    });

    expect(created!.name).toBe('My Paper');
    expect(result.current.active?.id).toBe(created!.id);
    expect(result.current.projects[0].id).toBe(created!.id);

    await expectScaffolded(created!.id, 'my-paper');
  });

  it('removing the active project switches to the next most recent project', async () => {
    const { result } = await bootProjects();
    const firstId = result.current.active!.id;

    await act(async () => {
      await result.current.create('Second', 'second');
    });
    expect(result.current.active!.name).toBe('Second');

    await act(async () => {
      await result.current.remove(result.current.active!.id);
    });

    expect(result.current.active!.name).toBe('Untitled project');
    expect(result.current.active!.id).toBe(firstId);
  });

  it('removing the last project auto-creates a fresh one', async () => {
    const { result } = await bootProjects();
    const firstId = result.current.active!.id;

    await act(async () => {
      await result.current.remove(firstId);
    });

    expect(result.current.active!.name).toBe('Untitled project');
    expect(result.current.active!.id).not.toBe(firstId);
    expect(await projectRegistry.list()).toHaveLength(1);
  });
});

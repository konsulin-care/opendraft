import { useCallback, useEffect, useState } from 'react';
import {
  ProjectRegistry,
  workspaceManager,
  type IndexedDBWorkspace,
  type ProjectRecord,
} from '@opendraft/workspace';
import { cleanupLegacyDatabases } from '../project/legacy-cleanup';
import { scaffoldProject } from '../project/scaffold';

/** localStorage key holding the active project id. */
export const ACTIVE_PROJECT_KEY = 'opendraft:active-project';

/** Display name of the auto-created project. */
const UNTITLED_NAME = 'Untitled project';

/** Manuscript id the auto-created project is scaffolded with. */
const UNTITLED_MANUSCRIPT_ID = 'untitled-project';

/**
 * Shared registry instance backing the project hooks. All hook consumers
 * talk to the same `od-registry` database through this instance.
 */
export const projectRegistry = new ProjectRegistry();

/** In-flight auto-creation, shared so concurrent boots create one project. */
let untitledInFlight: Promise<ProjectRecord> | null = null;

/**
 * Create the auto-created starter project: registers an "Untitled project"
 * record and scaffolds its workspace with the `untitled-project` manuscript.
 *
 * @param registry - Registry to register the record in.
 * @returns The created project record.
 */
async function createUntitledProject(registry: ProjectRegistry): Promise<ProjectRecord> {
  const record = await registry.create(UNTITLED_NAME);
  const ws = await workspaceManager.get(record.id);
  try {
    await scaffoldProject(ws, { manuscriptId: UNTITLED_MANUSCRIPT_ID });
  } finally {
    workspaceManager.release(record.id);
  }
  return record;
}

/**
 * Get-or-create the auto-created starter project. Concurrent callers share
 * a single in-flight creation, so a double-mounted boot registers exactly
 * one project.
 *
 * @param registry - Registry to register the record in.
 * @returns The created (or in-flight) project record.
 */
function ensureUntitledProject(registry: ProjectRegistry): Promise<ProjectRecord> {
  if (!untitledInFlight) {
    untitledInFlight = createUntitledProject(registry).finally(() => {
      untitledInFlight = null;
    });
  }
  return untitledInFlight;
}

/**
 * Register a new project, scaffold its workspace, and switch to it.
 *
 * @param name - Display name of the new project.
 * @param manuscriptId - Manuscript id the workspace is scaffolded with.
 * @param activate - Callback that makes the given project active.
 * @returns The created project record.
 */
async function scaffoldAndActivate(
  name: string,
  manuscriptId: string,
  activate: (id: string) => Promise<void>,
): Promise<ProjectRecord> {
  const record = await projectRegistry.create(name);
  const ws = await workspaceManager.get(record.id);
  try {
    await scaffoldProject(ws, { manuscriptId });
  } finally {
    workspaceManager.release(record.id);
  }
  await activate(record.id);
  return record;
}

/** Value returned by {@link useProjects}. */
export interface UseProjectsResult {
  /** Projects sorted by most recently opened first. */
  projects: ProjectRecord[];
  /** The active project record, or null before boot completes. */
  active: ProjectRecord | null;
  /** IndexedDB workspace of the active project, or null before boot completes. */
  workspace: IndexedDBWorkspace | null;
  /** True while the registry boot is in flight. */
  loading: boolean;
  /** Boot or mutation error, if any. */
  error: Error | null;
  /** Switch the active project: touches it and persists the choice. */
  switchTo: (id: string) => Promise<void>;
  /** Register a new project, scaffold its workspace, and switch to it. */
  create: (name: string, manuscriptId: string) => Promise<ProjectRecord>;
  /** Rename a project (the id never changes). */
  rename: (id: string, name: string) => Promise<void>;
  /** Remove a project; when it was active, switch to the next most recent or auto-create. */
  remove: (id: string) => Promise<void>;
}

/**
 * Boot effect: legacy cleanup, ensure at least one project exists, then
 * activate the persisted (or most recent) project. The loading flag clears
 * through `onSettled` once boot settles, successfully or not.
 *
 * @param activate - Callback that makes the given project active.
 * @param onError - Receives the boot error, if any.
 * @param onSettled - Receives false once boot has finished.
 */
function useBootEffect(
  activate: (id: string) => Promise<void>,
  onError: (err: Error) => void,
  onSettled: (loading: boolean) => void,
): void {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await cleanupLegacyDatabases();
        let list = await projectRegistry.list();
        if (list.length === 0) {
          await ensureUntitledProject(projectRegistry);
          list = await projectRegistry.list();
        }
        const storedId = localStorage.getItem(ACTIVE_PROJECT_KEY);
        const chosen = list.find((p) => p.id === storedId) ?? list[0];
        if (cancelled) return;
        await activate(chosen.id);
        if (cancelled) return;
        onSettled(false);
      } catch (err) {
        if (!cancelled) {
          onError(err as Error);
          onSettled(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activate, onError, onSettled]);
}

/**
 * Hold a workspace connection for the active project; release it when the
 * active project changes or the consumer unmounts.
 *
 * @param activeId - Id of the active project, or null before boot completes.
 * @param onError - Receives connection errors.
 * @returns The active project's workspace, or null.
 */
function useActiveWorkspace(
  activeId: string | null,
  onError: (err: Error) => void,
): IndexedDBWorkspace | null {
  const [workspace, setWorkspace] = useState<IndexedDBWorkspace | null>(null);
  useEffect(() => {
    if (!activeId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const ws = await workspaceManager.get(activeId);
        if (cancelled) {
          workspaceManager.release(activeId);
          return;
        }
        setWorkspace(ws);
      } catch (err) {
        if (!cancelled) onError(err as Error);
      }
    })();
    return () => {
      cancelled = true;
      workspaceManager.release(activeId);
    };
  }, [activeId, onError]);
  return workspace;
}

/**
 * Project registry hook powering the app shell.
 *
 * On boot it runs {@link cleanupLegacyDatabases}, lists the registry, and —
 * when the registry is empty — auto-creates and scaffolds an "Untitled
 * project". The active project id is persisted in localStorage under
 * `opendraft:active-project`. Removing the active project switches to the
 * most recently opened remaining project, or auto-creates a new one when
 * none remain.
 *
 * @returns See {@link UseProjectsResult}.
 */
export function useProjects(): UseProjectsResult {
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [active, setActive] = useState<ProjectRecord | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /** Touch a project, persist it as active, and refresh the visible state. */
  const activate = useCallback(async (id: string) => {
    await projectRegistry.touch(id);
    localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    const record = await projectRegistry.get(id);
    setActiveId(id);
    setActive(record ?? null);
    setProjects(await projectRegistry.list());
    setError(null);
  }, []);

  useBootEffect(activate, setError, setLoading);
  const workspace = useActiveWorkspace(activeId, setError);

  const switchTo = activate;

  const create = useCallback(
    (name: string, manuscriptId: string) => scaffoldAndActivate(name, manuscriptId, activate),
    [activate],
  );

  const rename = useCallback(async (id: string, name: string) => {
    await projectRegistry.rename(id, name);
    if (id === activeId) {
      setActive((await projectRegistry.get(id)) ?? null);
    }
    setProjects(await projectRegistry.list());
  }, [activeId]);

  const remove = useCallback(async (id: string) => {
    await projectRegistry.remove(id);
    const remaining = await projectRegistry.list();
    if (remaining.length === 0) {
      await activate((await ensureUntitledProject(projectRegistry)).id);
    } else if (id === activeId) {
      await activate(remaining[0].id);
    } else {
      setProjects(remaining);
    }
  }, [activeId, activate]);

  return { projects, active, workspace, loading, error, switchTo, create, rename, remove };
}

import { useCallback, useEffect, useState } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { resolveDefaultFile } from '../project/resolve-default-file';
import { projectRegistry } from './useProjects';

/** Value returned by {@link useActiveFile}. */
export interface UseActiveFileResult {
  /** Repo-relative path of the active file or manuscript directory, or null while unresolved. */
  activePath: string | null;
  /** Open a path (file or directory): sets it active and remembers it as the project's last path. */
  openFile: (path: string) => Promise<void>;
}

/**
 * Track the active path of a project.
 *
 * On mount (and whenever the workspace or project changes) the default path
 * is resolved via {@link resolveDefaultFile} using the registry's stored
 * last path, so the previously opened file or manuscript directory is
 * reopened after a remount. The active path may be a manuscript directory
 * (`manuscripts/<id>`), which the app renders as the manuscript view.
 * Every open persists the path back to the registry via `setLastPath`.
 *
 * @param ws - Workspace of the active project, or null before boot completes.
 * @param projectId - Id of the active project, or null before boot completes.
 * @returns See {@link UseActiveFileResult}.
 */
export function useActiveFile(ws: WorkspaceAdapter | null, projectId: string | null): UseActiveFileResult {
  const [activePath, setActivePath] = useState<string | null>(null);

  useEffect(() => {
    if (!ws || !projectId) {
      setActivePath(null);
      return undefined;
    }
    let cancelled = false;
    setActivePath(null);
    (async () => {
      const lastPath = await projectRegistry.getLastPath(projectId);
      const resolved = await resolveDefaultFile(ws, lastPath);
      if (!cancelled) {
        setActivePath(resolved);
      }
    })().catch((err: unknown) => {
      console.error('default file resolution failed:', err);
    });
    return () => {
      cancelled = true;
    };
  }, [ws, projectId]);

  const openFile = useCallback(async (path: string) => {
    setActivePath(path);
    if (projectId) {
      await projectRegistry.setLastPath(projectId, path);
    }
  }, [projectId]);

  return { activePath, openFile };
}

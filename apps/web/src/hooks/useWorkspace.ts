import { useEffect, useState } from 'react';
import { workspaceManager } from '@opendraft/workspace';
import { loadManuscript } from '../persistence';
import { seedWorkspace } from '../seed';
import type { IndexedDBWorkspace } from '@opendraft/workspace';

/**
 * Hook that manages a workspace lifecycle via WorkspaceManager.
 *
 * @param workspaceId - Unique identifier for the workspace.
 * @returns Object with workspace, markdown, loading, and error states.
 */
export function useWorkspace(workspaceId: string) {
  const [workspace, setWorkspace] = useState<IndexedDBWorkspace | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        setLoading(true);
        const ws = await workspaceManager.get(workspaceId);
        if (!active) {
          workspaceManager.release(workspaceId);
          return;
        }

        await seedWorkspace(ws);
        const md = await loadManuscript(ws);
        if (!active) {
          workspaceManager.release(workspaceId);
          return;
        }

        setWorkspace(ws);
        setMarkdown(md);
        setError(null);
      } catch (err) {
        if (active) {
          setError(err as Error);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
      workspaceManager.release(workspaceId);
    };
  }, [workspaceId]);

  return { workspace, markdown, loading, error };
}
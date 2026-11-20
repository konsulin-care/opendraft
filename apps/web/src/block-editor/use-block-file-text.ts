/**
 * Load a block file's text once the block has earned mounting.
 *
 * Reads at most once per path; a path change triggers a fresh read and
 * the cleanup marks an in-flight read stale.
 */
import { useEffect, useState } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';

/**
 * Load the block file text once the block has earned mounting.
 *
 * @param ws - Workspace holding the manuscript.
 * @param path - Path of the block file, e.g. `.../blocks/short.qmd`.
 * @param mounted - Whether the editor has earned mounting.
 * @returns The file text, or `null` while the load is pending.
 */
export function useBlockFileText(
  ws: WorkspaceAdapter,
  path: string,
  mounted: boolean,
): string | null {
  const [loaded, setLoaded] = useState<{ path: string; text: string } | null>(null);
  useEffect(() => {
    if (!mounted || loaded?.path === path) return undefined;
    let stale = false;
    void ws.readFile(path).then((text) => {
      if (!stale) setLoaded({ path, text: text ?? '' });
    });
    return () => {
      stale = true;
    };
  }, [mounted, loaded, ws, path]);
  return loaded !== null && loaded.path === path ? loaded.text : null;
}

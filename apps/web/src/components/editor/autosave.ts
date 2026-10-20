import { useEffect, useRef } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { saveFile } from '../../persistence';
import type { SaveStatus } from '../AppHeader';

/** Debounce window between the last edit and the workspace write. */
const SAVE_DEBOUNCE_MS = 800;

/** Imperative handle of a {@link debouncedSaver}. */
export interface DebouncedSaver {
  /** Point subsequent schedules at a new workspace path. */
  setPath(path: string): void;
  /** Schedule a debounced save of the latest content to the current path. */
  schedule(markdown: string): void;
  /** Save pending content (if any) immediately, then clear the timer. */
  flush(): void;
}

/**
 * Create a debounced autosave writing markdown to an explicit workspace path.
 *
 * The path is captured when a save is scheduled, so a pending edit is always
 * flushed to the path it was typed in — even if the component has since been
 * re-rendered with a new path prop.
 *
 * @param workspace - Workspace adapter for file I/O.
 * @param onStatus - Reports autosave progress: saving, saved, or error.
 * @returns Handle to schedule and flush saves.
 */
export function debouncedSaver(
  workspace: WorkspaceAdapter,
  onStatus: (status: SaveStatus) => void,
): DebouncedSaver {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let currentPath = '';
  let pendingPath: string | undefined;
  let pending: string | undefined;

  const save = (path: string, markdown: string): void => {
    void saveFile(workspace, path, markdown).then(
      () => {
        if (!timer) onStatus('saved');
      },
      (error: unknown) => {
        console.error('manuscript autosave failed:', error);
        onStatus('error');
      },
    );
  };

  return {
    setPath: (path: string): void => { currentPath = path; },
    schedule: (markdown: string): void => {
      if (timer) clearTimeout(timer);
      onStatus('saving');
      const path = currentPath;
      pendingPath = path;
      pending = markdown;
      timer = setTimeout(() => {
        timer = undefined;
        pendingPath = undefined;
        pending = undefined;
        save(path, markdown);
      }, SAVE_DEBOUNCE_MS);
    },
    flush: (): void => {
      if (timer) clearTimeout(timer);
      timer = undefined;
      if (pending !== undefined) {
        // Write to the path the edit was scheduled for (the OLD path when
        // flushing ahead of a file switch), not the current one.
        save(pendingPath ?? currentPath, pending);
        pending = undefined;
        pendingPath = undefined;
      }
    },
  };
}

/**
 * Create a stable debounced saver for an editor mounted at `path`.
 *
 * Pending edits always land on the path they were typed in: when `path`
 * changes or the component unmounts, the pending save is flushed to the
 * OLD path before new content loads.
 *
 * @param workspace - Workspace adapter for file I/O.
 * @param path - Current workspace path of the edited file.
 * @param onStatus - Reports autosave progress: saving, saved, or error.
 * @returns A stable saver handle whose identity persists across renders.
 */
export function useDebouncedSaver(
  workspace: WorkspaceAdapter,
  path: string,
  onStatus?: (status: SaveStatus) => void,
): DebouncedSaver {
  const statusRef = useRef(onStatus);
  statusRef.current = onStatus;
  const saverRef = useRef<DebouncedSaver | null>(null);
  if (!saverRef.current) saverRef.current = debouncedSaver(workspace, (s) => statusRef.current?.(s));

  // Flush ahead of a file switch: the pending save lands on the OLD path
  // before the new file's content loads (this effect runs before the
  // editor-recreation effects declared below it in the editor hook).
  useEffect(() => {
    saverRef.current?.flush();
    saverRef.current?.setPath(path);
  }, [path]);

  // Unmount flushes any pending edit instead of dropping it.
  useEffect(() => () => saverRef.current?.flush(), []);

  return saverRef.current;
}

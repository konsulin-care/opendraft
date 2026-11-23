/** Serializes draft actions, records errors in state and refreshes the snapshot. */
import { useCallback, useRef, useState } from 'react';
import type { ProjectRecord } from '@opendraft/workspace';
import type { SaveConflictResolver } from '../suggest/save';
import type { DraftActionContext } from './use-draft';

/** Convert an unknown thrown value into a display message. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface RunnerReport {
  refresh: () => Promise<void>;
  setError: (error: string | null) => void;
  setNotice: (notice: string | null) => void;
}

interface RunOptions {
  /** Rethrow the original failure after it has been recorded in state. */
  rethrow?: boolean;
}

/**
 * Build the action runner for the draft workflow.
 *
 * @param project - Active project, or null when nothing is open.
 * @param resolveConflicts - Resolver passed to save actions on conflicts.
 * @param report - Effect callbacks for refreshing and recording state.
 * @returns Busy flag, guarded run function and action context factory.
 */
export function useRunner(
  project: ProjectRecord | null,
  resolveConflicts: SaveConflictResolver,
  report: RunnerReport,
) {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const latestProject = useRef(project);
  latestProject.current = project;
  const { refresh, setError, setNotice } = report;
  const run = useCallback(
    async <T,>(
      work: () => Promise<T>,
      options: RunOptions = {},
    ): Promise<T | null> => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      setError(null);
      setNotice(null);
      let result: T | null = null;
      let failure: unknown;
      let failed = false;
      try {
        result = await work();
      } catch (thrown) {
        failed = true;
        failure = thrown;
        setError(errorMessage(thrown));
      } finally {
        try {
          await refresh();
        } catch (thrown) {
          setError(errorMessage(thrown));
        }
        busyRef.current = false;
        setBusy(false);
      }
      if (failed && options.rethrow) throw failure;
      return result;
    },
    [refresh, setError, setNotice],
  );
  const context = useCallback((): DraftActionContext | null => {
    const active = latestProject.current;
    return active === null ? null : { project: active, resolveConflicts };
  }, [resolveConflicts]);
  return { busy, run, context };
}

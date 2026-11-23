/** Draft workflow controller: load, derive view, run actions, resolve conflicts. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectRecord } from '@opendraft/workspace';
import { draftView } from '../suggest/draft-view';
import type { DraftView } from '../suggest/draft-view';
import type {
  SaveConflictChoice,
  SaveConflictResolver,
  SaveGitHubResult,
} from '../suggest/save';
import type { SuggestionStatus } from '../suggest/status';
import type {
  SendSuggestionInput,
  SendSuggestionResult,
  SendUpdateInput,
} from '../suggest/submit';

export const DRAFT_NOTICE_TIMEOUT_MS = 4000;
const SAVED_NOTICE = 'Saved to GitHub';
export interface DraftSnapshot {
  status: SuggestionStatus;
  pendingSaves?: number;
}
export interface PublishDraftInput {
  owner?: string;
  repo?: string;
  private?: boolean;
}
export interface DraftActionContext {
  project: ProjectRecord;
  resolveConflicts: SaveConflictResolver;
}
export interface UseDraftDeps {
  load: (project: ProjectRecord) => Promise<DraftSnapshot>;
  save: (context: DraftActionContext) => Promise<SaveGitHubResult>;
  send: (
    context: DraftActionContext,
    input: SendSuggestionInput,
  ) => Promise<SendSuggestionResult>;
  update: (
    context: DraftActionContext,
    input: SendUpdateInput,
  ) => Promise<SaveGitHubResult>;
  startNew: (context: DraftActionContext) => Promise<unknown>;
  publish: (
    context: DraftActionContext,
    input: PublishDraftInput,
  ) => Promise<unknown>;
}
export interface DraftActions {
  save: () => Promise<void>;
  send: (input?: SendSuggestionInput) => Promise<void>;
  update: (input?: SendUpdateInput) => Promise<void>;
  startNew: () => Promise<void>;
  publish: (input?: PublishDraftInput) => Promise<void>;
}
export interface UseDraftResult extends DraftActions {
  status: SuggestionStatus | null;
  pendingSaves: number;
  view: DraftView;
  loading: boolean;
  busy: boolean;
  error: string | null;
  notice: string | null;
  conflicts: string[] | null;
  resolveConflicts: (choices: Record<string, SaveConflictChoice>) => void;
}
interface ActionEffects {
  showNotice: (message: string) => void;
  setPendingSaves: (count: number) => void;
  currentStatus: () => SuggestionStatus | null;
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
function sentNotice(number: number): string {
  return `Suggestion #${number} sent`;
}
function useLoadEffect(
  projectId: string | undefined,
  refresh: () => Promise<void>,
  setError: (error: string | null) => void,
  setLoading: (loading: boolean) => void,
): void {
  useEffect(() => {
    let cancelled = false;
    const load = async (initial: boolean): Promise<void> => {
      try {
        await refresh();
      } catch (thrown) {
        if (!cancelled) setError(errorMessage(thrown));
      } finally {
        if (initial && !cancelled) setLoading(false);
      }
    };
    setLoading(true);
    void load(true);
    const onFocus = (): void => void load(false);
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, [projectId, refresh, setError, setLoading]);
}

function useSnapshot(
  project: ProjectRecord | null,
  deps: UseDraftDeps,
) {
  const [status, setStatus] = useState<SuggestionStatus | null>(null);
  const [pendingSaves, setPendingSaves] = useState(0);
  const [loading, setLoading] = useState(project !== null);
  const [error, setError] = useState<string | null>(null);
  const latestDeps = useRef(deps);
  const latestProject = useRef(project);
  latestDeps.current = deps;
  latestProject.current = project;
  const refresh = useCallback(async (): Promise<void> => {
    const active = latestProject.current;
    if (active === null) {
      setStatus(null);
      setPendingSaves(0);
      setLoading(false);
      return;
    }
    const snapshot = await latestDeps.current.load(active);
    setStatus(snapshot.status);
    setPendingSaves(snapshot.pendingSaves ?? 0);
  }, []);
  useLoadEffect(project?.id, refresh, setError, setLoading);
  return { status, pendingSaves, loading, error, setError, setPendingSaves, refresh };
}

function useUi() {
  const [notice, setNotice] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<string[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{
    resolve: (choices: Record<string, SaveConflictChoice>) => void;
  } | null>(null);
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);
  const showNotice = useCallback((message: string): void => {
    if (timer.current !== null) clearTimeout(timer.current);
    setNotice(message);
    timer.current = setTimeout(() => {
      timer.current = null;
      setNotice(null);
    }, DRAFT_NOTICE_TIMEOUT_MS);
  }, []);
  const resolver = useCallback<SaveConflictResolver>(
    (paths) =>
      new Promise((resolve) => {
        pending.current = { resolve };
        setConflicts(paths);
      }),
    [],
  );
  const resolveConflicts = useCallback(
    (choices: Record<string, SaveConflictChoice>): void => {
      const waiting = pending.current;
      pending.current = null;
      setConflicts(null);
      waiting?.resolve(choices);
    },
    [],
  );
  return { notice, setNotice, showNotice, conflicts, resolver, resolveConflicts };
}
function useRunner(
  project: ProjectRecord | null,
  resolveConflicts: SaveConflictResolver,
  report: {
    refresh: () => Promise<void>;
    setError: (error: string | null) => void;
    setNotice: (notice: string | null) => void;
  },
) {
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const latestProject = useRef(project);
  latestProject.current = project;
  const { refresh, setError, setNotice } = report;
  const run = useCallback(
    async <T,>(work: () => Promise<T>): Promise<T | null> => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      setError(null);
      setNotice(null);
      let result: T | null = null;
      try {
        result = await work();
      } catch (thrown) {
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
function createActions(
  deps: UseDraftDeps,
  runner: ReturnType<typeof useRunner>,
  effects: ActionEffects,
): DraftActions {
  const { run, context } = runner;
  const { showNotice, setPendingSaves, currentStatus } = effects;
  return {
    save: async () => {
      const action = context();
      if (action === null) return;
      const result = await run(() => deps.save(action));
      if (result?.kind === 'saved') showNotice(SAVED_NOTICE);
      if (result?.kind === 'pending') setPendingSaves(result.pendingSaves);
    },
    send: async (input = {}) => {
      const action = context();
      if (action === null) return;
      const result = await run(() => deps.send(action, input));
      if (result?.kind === 'created' || result?.kind === 'updated') {
        showNotice(sentNotice(result.number));
      }
      if (result?.kind === 'pending') setPendingSaves(result.pendingSaves);
    },
    update: async (input = {}) => {
      const action = context();
      if (action === null) return;
      const result = await run(() => deps.update(action, input));
      if (result?.kind === 'saved') {
        const number = currentStatus()?.number;
        showNotice(number === undefined ? SAVED_NOTICE : sentNotice(number));
      }
      if (result?.kind === 'pending') setPendingSaves(result.pendingSaves);
    },
    startNew: async () => {
      const action = context();
      if (action !== null) await run(() => deps.startNew(action));
    },
    publish: async (input = {}) => {
      const action = context();
      if (action !== null) await run(() => deps.publish(action, input));
    },
  };
}

/** Load, run and refresh the draft workflow; see {@link UseDraftResult}. */
export function useDraft(
  project: ProjectRecord | null,
  deps: UseDraftDeps,
): UseDraftResult {
  const snapshot = useSnapshot(project, deps);
  const ui = useUi();
  const runner = useRunner(project, ui.resolver, {
    refresh: snapshot.refresh,
    setError: snapshot.setError,
    setNotice: ui.setNotice,
  });
  const actions = createActions(deps, runner, {
    showNotice: ui.showNotice,
    setPendingSaves: snapshot.setPendingSaves,
    currentStatus: () => snapshot.status,
  });
  const view = draftView({
    source: project?.source ?? { kind: 'local' },
    state: snapshot.status?.state ?? 'local-only',
    pendingSaves: snapshot.pendingSaves,
  });
  return {
    ...actions,
    status: snapshot.status,
    pendingSaves: snapshot.pendingSaves,
    view,
    loading: snapshot.loading,
    busy: runner.busy,
    error: snapshot.error,
    notice: ui.notice,
    conflicts: ui.conflicts,
    resolveConflicts: ui.resolveConflicts,
  };
}

export default useDraft;

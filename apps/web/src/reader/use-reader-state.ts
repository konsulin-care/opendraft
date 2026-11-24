/**
 * Reader state hook: loads the session and repository for a route, reports
 * loading phases, checks for a newer commit and reloads on demand.
 */

import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { ProjectDiscovery } from '@opendraft/manuscript';
import { discoverProject } from '@opendraft/manuscript';
import type { BffSession, SessionState } from '../github/bff-client';
import type { LoadedRepo, LoadPhase, OnLoadPhase } from './load-repo';
import type { ReaderRoute } from './route';

/** Reader state loaded from the route and injected dependencies. */
export interface ReaderState {
  /** Signed-in session identity, or null for an anonymous viewer. */
  session: BffSession | null;
  /** Whether GitHub login is configured. */
  loginEnabled: boolean;
  /** Loaded repository, or null while loading or after a load error. */
  repo: LoadedRepo | null;
  /** Load error, or null when the repository loaded. */
  error: unknown;
  /** Whether the repository is still loading. */
  loading: boolean;
  /** Latest loading phase reported by the repository loader. */
  phase: LoadPhase;
  /** Whether the current load had to download the repository. */
  firstVisit: boolean;
  /** Newer commit SHA available for the repository, or null. */
  updateAvailable: string | null;
  /** Reload the repository at its latest commit, bypassing the cache pointer. */
  refresh: () => void;
  /** Clear the session. */
  logout: () => void;
}

/** Dependencies the reader state hook needs from the page. */
interface ReaderStateDeps {
  /** Load a route while reporting phases, optionally bypassing the cache pointer. */
  loadRepo: (
    route: ReaderRoute,
    onPhase: OnLoadPhase,
    options: { fresh?: boolean },
  ) => Promise<LoadedRepo>;
  /** Read the session state from the BFF. */
  getSessionState: () => Promise<SessionState>;
  /** Clear the session and local private data. */
  logout: () => Promise<void>;
}

/** State of one requested load: whether it is fresh plus a reload counter. */
interface LoadRequest {
  /** Whether the loader should ignore the latest-SHA cache pointer. */
  fresh: boolean;
  /** Increments on every refresh to rerun the load effect. */
  nonce: number;
}

/** Everything one load writes into component state. */
interface LoadSnapshot {
  session: BffSession | null;
  loginEnabled: boolean;
  repo: LoadedRepo | null;
  error: unknown;
  loading: boolean;
  phase: LoadPhase;
  firstVisit: boolean;
  updateAvailable: string | null;
}

/** Merge a patch into the current load snapshot. */
type UpdateSnapshot = (patch: Partial<LoadSnapshot>) => void;

const INITIAL_SNAPSHOT: LoadSnapshot = {
  session: null,
  loginEnabled: true,
  repo: null,
  error: null,
  loading: true,
  phase: 'checking',
  firstVisit: false,
  updateAvailable: null,
};

/** Everything one repository load needs: route, dependencies, request and sink. */
interface LoadContext {
  route: ReaderRoute;
  deps: ReaderStateDeps;
  request: LoadRequest;
  update: UpdateSnapshot;
  isCancelled: () => boolean;
}

/** Run one repository load, reporting phases and the background update check. */
async function loadRepository(context: LoadContext): Promise<void> {
  const { route, deps, request, update, isCancelled } = context;
  const onPhase: OnLoadPhase = (next) => {
    if (isCancelled()) return;
    update({ phase: next, ...(next === 'downloading' ? { firstVisit: true } : {}) });
  };
  try {
    const [nextState, loaded] = await Promise.all([
      deps.getSessionState(),
      deps.loadRepo(route, onPhase, { fresh: request.fresh }),
    ]);
    if (isCancelled()) return;
    update({
      session: nextState.session,
      loginEnabled: nextState.loginEnabled,
      repo: loaded,
      error: null,
      loading: false,
    });
    await checkForUpdate(loaded, isCancelled, (sha) => update({ updateAvailable: sha }));
  } catch (thrown) {
    if (!isCancelled()) update({ error: thrown, loading: false });
  }
}

/** Load the session and repository snapshot, rerunning when the request changes. */
function useLoadSnapshot(
  route: ReaderRoute,
  deps: ReaderStateDeps,
  request: LoadRequest,
): { snapshot: LoadSnapshot; setSnapshot: Dispatch<SetStateAction<LoadSnapshot>> } {
  const [snapshot, setSnapshot] = useState<LoadSnapshot>(INITIAL_SNAPSHOT);
  useEffect(() => {
    let cancelled = false;
    const update: UpdateSnapshot = (patch) => setSnapshot((previous) => ({ ...previous, ...patch }));
    update({ loading: true, error: null, repo: null, phase: 'checking', updateAvailable: null });
    void loadRepository({ route, deps, request, update, isCancelled: () => cancelled });
    return () => {
      cancelled = true;
    };
  }, [route.owner, route.repo, route.ref, deps, request]);
  return { snapshot, setSnapshot };
}

/**
 * Load the session and repository, exposing loading state and refresh.
 *
 * @param route - Repository owner, name and optional ref.
 * @param deps - Injected session and repository loader dependencies.
 * @returns Reader state for the current route.
 */
export function useReaderState(route: ReaderRoute, deps: ReaderStateDeps): ReaderState {
  const [request, setRequest] = useState<LoadRequest>({ fresh: false, nonce: 0 });
  const { snapshot, setSnapshot } = useLoadSnapshot(route, deps, request);

  const refresh = (): void => {
    setRequest((previous) => ({ fresh: true, nonce: previous.nonce + 1 }));
  };

  const logout = (): void => {
    void (async () => {
      try {
        await deps.logout();
      } finally {
        setSnapshot((previous) => ({ ...previous, session: null }));
      }
    })();
  };

  return { ...snapshot, refresh, logout };
}

/** Run the loaded repository's background update check, when present. */
async function checkForUpdate(
  repo: LoadedRepo,
  isCancelled: () => boolean,
  report: (sha: string | null) => void,
): Promise<void> {
  if (repo.checkForUpdate === undefined) return;
  try {
    const sha = await repo.checkForUpdate();
    if (!isCancelled()) report(sha);
  } catch {
    // A failed background check must not break the already loaded reader.
  }
}

/** Discover a repository's existing manuscripts, read-only. */
export function useDiscovery(repo: LoadedRepo | null): {
  discovery: ProjectDiscovery | null;
  error: unknown;
} {
  const [discovery, setDiscovery] = useState<ProjectDiscovery | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    setDiscovery(null);
    setError(null);
    if (repo === null) return;

    let cancelled = false;
    void (async () => {
      try {
        const next = await discoverProject(repo.workspace);
        if (!cancelled) setDiscovery(next);
      } catch (thrown) {
        if (!cancelled) setError(thrown);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [repo]);

  return { discovery, error };
}

export default useReaderState;

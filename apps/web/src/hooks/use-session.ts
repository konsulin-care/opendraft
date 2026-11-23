/**
 * Session state for the editor shell.
 *
 * Mirrors the reader's session handling: load the BFF session and whether
 * login is enabled once per mount, and sign out by clearing the BFF session,
 * purging private GitHub projects and dropping the in-memory session.
 */

import { useEffect, useRef, useState } from 'react';
import type { BffSession, SessionState } from '../github/bff-client';
import { getSessionState, logout as signOut } from '../github/bff-client';

/** Session operations injectable for tests and alternate shells. */
export interface UseSessionDeps {
  /** Read the current BFF session and whether login is configured. */
  getSessionState: () => Promise<SessionState>;
  /** Clear the BFF session. */
  logout: () => Promise<void>;
  /** Remove private GitHub projects that must not stay visible after sign-out. */
  purge: () => Promise<unknown>;
}

/** Value returned by {@link useSession}. */
export interface UseSessionResult {
  /** Current BFF session, or null while loading or signed out. */
  session: BffSession | null;
  /** Whether GitHub login is configured; true until the first load resolves. */
  loginEnabled: boolean;
  /** True until the initial session lookup settles. */
  loading: boolean;
  /**
   * Clear the BFF session, purge private projects and expose no session.
   *
   * @returns A promise that settles once the sign-out work has finished.
   */
  logout: () => Promise<void>;
}

/** Purge private GitHub projects through the shared project registry. */
async function purgePrivate(): Promise<void> {
  const [{ projectRegistry }, { purgePrivateProjects }] = await Promise.all([
    import('./useProjects'),
    import('../suggest/purge'),
  ]);
  await purgePrivateProjects(projectRegistry);
}

/** Live dependencies backed by the BFF client and the project registry. */
const defaultDeps: UseSessionDeps = {
  getSessionState: () => getSessionState(),
  logout: () => signOut(),
  purge: purgePrivate,
};

/**
 * Load the BFF session for the editor and expose a sign-out action.
 *
 * The lookup runs once per mount. A failed lookup leaves the shell signed out
 * with login enabled, so a network error never blocks the editor.
 *
 * @param deps - Session operations; defaults to the live BFF and registry.
 * @returns The loaded session state and the sign-out action.
 */
export function useSession(deps: UseSessionDeps = defaultDeps): UseSessionResult {
  const [session, setSession] = useState<BffSession | null>(null);
  const [loginEnabled, setLoginEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const latestDeps = useRef(deps);
  latestDeps.current = deps;

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const state = await latestDeps.current.getSessionState();
        if (cancelled) return;
        setSession(state.session);
        setLoginEnabled(state.loginEnabled);
      } catch {
        if (cancelled) return;
        setSession(null);
        setLoginEnabled(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const logout = async (): Promise<void> => {
    try {
      await latestDeps.current.logout();
    } finally {
      try {
        await latestDeps.current.purge();
      } finally {
        setSession(null);
      }
    }
  };

  return { session, loginEnabled, loading, logout };
}

/**
 * Repository access hook for the reader header.
 *
 * Loads the signed-in viewer's permissions for one repository on mount so the
 * header can label its main action ("Edit" versus "Suggest edits") before the
 * viewer clicks it. Anonymous viewers and disabled login resolve immediately
 * to no access without touching the BFF.
 */

import { useEffect, useState } from 'react';
import type { BffSession, RepoPermissions } from '../github/bff-client';
import { getRepoPermissions } from '../github/bff-client';

/** Input of {@link useRepoAccess}. */
export interface UseRepoAccessInput {
  /** Repository owner login. */
  owner: string;
  /** Repository name. */
  repo: string;
  /** Signed-in session, or null for an anonymous viewer. */
  session: BffSession | null;
  /** Whether GitHub login is configured. */
  loginEnabled: boolean;
  /** Read repository permissions; defaults to the BFF client. */
  getAccess?: (owner: string, repo: string) => Promise<RepoPermissions>;
}

/** Access state returned by {@link useRepoAccess}. */
export interface RepoAccessState {
  /** Permissions of the signed-in viewer, or null when unavailable. */
  access: RepoPermissions | null;
  /** Whether the permission lookup is still pending. */
  loading: boolean;
  /** Error message from a failed lookup, or null. */
  error: string | null;
}

/** Read a human-readable message from an unknown thrown value. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Load repository permissions for the current viewer and repository.
 *
 * The lookup runs once per owner/repo (and again when the session or login
 * configuration changes). Signed-out viewers and disabled login skip the call
 * and settle with `access: null`. Results from a superseded lookup are
 * discarded.
 *
 * @param input - Repository identity, session state and injectable lookup.
 * @returns The loaded permissions plus loading and error flags.
 */
export function useRepoAccess({
  owner,
  repo,
  session,
  loginEnabled,
  getAccess = getRepoPermissions,
}: UseRepoAccessInput): RepoAccessState {
  const [access, setAccess] = useState<RepoPermissions | null>(null);
  const [loading, setLoading] = useState(session !== null && loginEnabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session === null || !loginEnabled) {
      setAccess(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getAccess(owner, repo).then(
      (result) => {
        if (cancelled) return;
        setAccess(result);
        setLoading(false);
      },
      (thrown: unknown) => {
        if (cancelled) return;
        setAccess(null);
        setError(errorMessage(thrown));
        setLoading(false);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [owner, repo, session, loginEnabled, getAccess]);

  return { access, loading, error };
}

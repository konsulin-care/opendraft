/**
 * Reader content for a loaded repository.
 *
 * Renders the loading indicator, load error, conversion panel or read-only
 * manuscript view. Plain repositories are discovered read-only so the
 * conversion panel can offer the existing manuscripts as a checklist.
 */

import { useEffect, useState } from 'react';
import type { InitDecisions, ProjectDiscovery } from '@opendraft/manuscript';
import { discoverProject, normalizeManuscriptId } from '@opendraft/manuscript';
import type { BffSession } from '../github/bff-client';
import { loginUrl } from '../github/bff-client';
import { ManuscriptView } from '../components/ManuscriptView';
import { ConvertPanel } from './ConvertPanel';
import { ManuscriptIndex } from './ManuscriptIndex';
import type { ConvertResult } from './convert';
import type { LoadedRepo } from './load-repo';
import { NotFoundError, RateLimitedError } from './github-public';
import type { ReaderRoute } from './route';
import { UnlistedBanner } from './UnlistedBanner';

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
  /** Clear the session. */
  logout: () => void;
}

/** Props for {@link ReaderContent}. */
export interface ReaderContentProps {
  /** Repository owner, name and optional ref from the URL. */
  route: ReaderRoute;
  /** Reader state loaded from the route and dependencies. */
  state: ReaderState;
  /** Start a conversion with the chosen registration decisions. */
  convert: (decisions: InitDecisions) => Promise<ConvertResult>;
  /** Register unlisted manuscript ids in the project configuration. */
  register: (ids: string[]) => Promise<ConvertResult>;
}

/** Return the reader path (`/{owner}/{repo}[/tree/{ref}]`) for a route. */
function readerPath(route: ReaderRoute): string {
  const base = `/${route.owner}/${route.repo}`;
  return route.ref === undefined ? base : `${base}/tree/${route.ref}`;
}

/** Render the rate-limit, not-found or generic load error. */
function LoadError({ error, returnTo }: { error: unknown; returnTo: string }) {
  if (error instanceof RateLimitedError) {
    return (
      <section className="flex flex-col gap-2 rounded-md border border-outline p-4">
        <p className="text-sm text-black">
          GitHub rate limit reached. Sign in for higher limits.
        </p>
        <a href={loginUrl(returnTo)} className="text-sm font-medium text-inline-code underline">
          Sign in for higher limits
        </a>
      </section>
    );
  }

  if (error instanceof NotFoundError) {
    return <p className="text-sm text-black">Repository not found or private.</p>;
  }

  return (
    <p role="alert" className="text-sm text-error">
      {error instanceof Error ? error.message : String(error)}
    </p>
  );
}

/** Discover a repository's existing manuscripts, read-only. */
function useDiscovery(repo: LoadedRepo | null): {
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

/**
 * Resolve the manuscript selected by the route.
 *
 * A single manuscript is always shown directly; with several manuscripts the
 * `?manuscript=<id>` value picks one and an absent or unknown id shows the index.
 *
 * @param manuscripts - Manuscripts declared by the repository.
 * @param requested - Manuscript id from the URL, when present.
 * @returns The selected manuscript, or undefined for the index.
 */
function resolveManuscript(
  manuscripts: LoadedRepo['manuscripts'],
  requested: string | undefined,
): LoadedRepo['manuscripts'][number] | undefined {
  if (manuscripts.length === 1) return manuscripts[0];
  if (requested === undefined) return undefined;
  return manuscripts.find((manuscript) => manuscript.id === requested);
}

/** Render the unlisted banner, index or manuscript. */
function OpenDraftContent({
  route,
  state,
  repo,
  discovery,
  register,
}: {
  route: ReaderRoute;
  state: ReaderState;
  repo: LoadedRepo;
  discovery: ProjectDiscovery | null;
  register: (ids: string[]) => Promise<ConvertResult>;
}) {
  const manuscript = resolveManuscript(repo.manuscripts, route.manuscript);
  return (
    <>
      {discovery !== null && discovery.unlisted.length > 0 && state.session !== null ? (
        <UnlistedBanner discovery={discovery} session={state.session} register={register} />
      ) : null}
      {manuscript === undefined ? (
        repo.manuscripts.length > 1 ? (
          <ManuscriptIndex
            workspace={repo.workspace}
            manuscripts={repo.manuscripts}
            route={route}
          />
        ) : (
          <p className="text-sm text-black">No manuscripts found.</p>
        )
      ) : (
        <ManuscriptView
          workspace={repo.workspace}
          dir={manuscript.path}
          projectKey={`reader:${route.owner}/${route.repo}@${repo.sha}`}
          readOnly
        />
      )}
    </>
  );
}

/**
 * Render the loading indicator, load error, conversion panel or reader view.
 *
 * @param props - See {@link ReaderContentProps}.
 * @returns The content for the current reader state.
 */
export function ReaderContent({ route, state, convert, register }: ReaderContentProps) {
  const { session, loginEnabled, repo, error, loading } = state;
  const { discovery, error: discoveryError } = useDiscovery(repo);
  const returnTo = readerPath(route);

  if (loading) return <p className="text-sm text-black">Loading…</p>;
  if (error !== null) return <LoadError error={error} returnTo={returnTo} />;
  if (repo === null) return null;

  if (!repo.isOpenDraft) {
    if (discoveryError !== null) {
      return <LoadError error={discoveryError} returnTo={returnTo} />;
    }
    if (discovery === null) return <p className="text-sm text-black">Loading…</p>;
    return (
      <ConvertPanel
        session={session}
        returnTo={returnTo}
        discovery={discovery}
        defaultId={normalizeManuscriptId(route.repo)}
        convert={convert}
        loginEnabled={loginEnabled}
      />
    );
  }

  return (
    <OpenDraftContent
      route={route}
      state={state}
      repo={repo}
      discovery={discovery}
      register={register}
    />
  );
}

export default ReaderContent;

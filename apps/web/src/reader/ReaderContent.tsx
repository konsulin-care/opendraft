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
import type { ConvertResult } from './convert';
import type { LoadedRepo } from './load-repo';
import { NotFoundError, RateLimitedError } from './github-public';
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
  /** Index of the selected manuscript. */
  selected: number;
  /** Select a manuscript by index. */
  select: (index: number) => void;
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

/** Render one button per manuscript when more than one is declared. */
function ManuscriptSwitcher({
  manuscripts,
  selected,
  onSelect,
}: {
  manuscripts: LoadedRepo['manuscripts'];
  selected: number;
  onSelect: (index: number) => void;
}) {
  if (manuscripts.length <= 1) return null;
  return (
    <nav aria-label="Manuscripts" className="flex flex-wrap gap-2">
      {manuscripts.map((manuscript, index) => (
        <button
          key={manuscript.id}
          type="button"
          aria-pressed={index === selected}
          onClick={() => onSelect(index)}
          className="rounded-md border border-outline px-3 py-1.5 text-sm font-medium text-black"
        >
          {manuscript.id}
        </button>
      ))}
    </nav>
  );
}

/** Discover a plain repository's existing manuscripts, read-only. */
function useDiscovery(repo: LoadedRepo | null): {
  discovery: ProjectDiscovery | null;
  error: unknown;
} {
  const [discovery, setDiscovery] = useState<ProjectDiscovery | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    setDiscovery(null);
    setError(null);
    if (repo === null || repo.isOpenDraft) return;

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
 * Render the loading indicator, load error, conversion panel or reader view.
 *
 * @param props - See {@link ReaderContentProps}.
 * @returns The content for the current reader state.
 */
export function ReaderContent({ route, state, convert }: ReaderContentProps) {
  const { session, loginEnabled, repo, error, loading, selected, select } = state;
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

  const manuscript = repo.manuscripts[selected] ?? repo.manuscripts[0];
  return (
    <>
      <ManuscriptSwitcher manuscripts={repo.manuscripts} selected={selected} onSelect={select} />
      {manuscript === undefined ? (
        <p className="text-sm text-black">No manuscripts found.</p>
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

export default ReaderContent;

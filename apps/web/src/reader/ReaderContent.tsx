/**
 * Reader content for a loaded repository.
 *
 * Renders the loading indicator, load error, non-compliant notice or read-only
 * manuscript view. Plain repositories are discovered read-only so the notice
 * can list the detected manuscripts as candidates.
 */

import { useEffect, useRef, useState } from 'react';
import type { ProjectDiscovery } from '@opendraft/manuscript';
import type { BffSession } from '../github/bff-client';
import { loginUrl } from '../github/bff-client';
import { ManuscriptView } from '../components/ManuscriptView';
import { ManuscriptIndex } from './ManuscriptIndex';
import { NonCompliantNotice } from './NonCompliantNotice';
import type { ConvertResult } from './convert';
import type { LoadedRepo } from './load-repo';
import { NotFoundError, RateLimitedError } from './github-public';
import { clearIntent } from './intent-url';
import { READER_COPY } from './reader-copy';
import { ReaderLoading } from './ReaderLoading';
import { ReaderUpdateBanner } from './ReaderUpdateBanner';
import type { ReaderRoute } from './route';
import { readerManuscript } from './route';
import { UnlistedBanner } from './UnlistedBanner';
import type { ReaderState } from './use-reader-state';

export { useDiscovery } from './use-reader-state';
export type { ReaderState } from './use-reader-state';

/** Props for {@link ReaderContent}. */
export interface ReaderContentProps {
  /** Repository owner, name and optional ref from the URL. */
  route: ReaderRoute;
  /** Reader state loaded from the route and dependencies. */
  state: ReaderState;
  /** Register unlisted manuscript ids in the project configuration. */
  register: (ids: string[]) => Promise<ConvertResult>;
  /** Read-only discovery result, or null while it is still loading. */
  discovery: ProjectDiscovery | null;
  /** Discovery error, or null when discovery succeeded. */
  discoveryError: unknown;
  /** Whether the viewer may push to the repository. */
  canWrite: boolean;
}

/** Return the reader path (`/{owner}/{repo}[/tree/{ref}]`) for a route. */
export function readerPath(route: ReaderRoute): string {
  const base = `/${route.owner}/${route.repo}`;
  return route.ref === undefined ? base : `${base}/tree/${route.ref}`;
}

/** Read the manuscript id from the browser URL query. */
function locationManuscript(): string | undefined {
  return typeof window === 'undefined' ? undefined : readerManuscript(window.location.search);
}

/** Resolve the manuscript requested by the route, if any. */
function resolveCurrent(
  manuscripts: LoadedRepo['manuscripts'],
  requested: string | undefined,
): LoadedRepo['manuscripts'][number] | undefined {
  if (manuscripts.length === 1) return manuscripts[0];
  if (requested === undefined) return undefined;
  return manuscripts.find((manuscript) => manuscript.id === requested);
}

export function useReaderNavigation(
  route: ReaderRoute,
  manuscripts: LoadedRepo['manuscripts'],
): {
  current: LoadedRepo['manuscripts'][number] | undefined;
  contentRoute: ReaderRoute;
  navigateTo: (id: string | null) => void;
} {
  const [override, setOverride] = useState<string | null | undefined>(undefined);
  const requested = override === undefined
    ? route.manuscript ?? locationManuscript()
    : override ?? undefined;
  const current = resolveCurrent(manuscripts, requested);

  useEffect(() => {
    setOverride(undefined);
  }, [route.owner, route.repo, route.ref, route.manuscript]);

  useEffect(() => {
    const restore = (): void => setOverride(undefined);
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);

  const navigateTo = (id: string | null): void => {
    setOverride(id);
    if (typeof window === 'undefined') return;
    const href = id === null
      ? readerPath(route)
      : `${readerPath(route)}?manuscript=${encodeURIComponent(id)}`;
    window.history.pushState({}, '', href);
  };

  const contentRoute = requested === undefined
    ? { ...route, manuscript: undefined }
    : { ...route, manuscript: requested };
  return { current, contentRoute, navigateTo };
}

/** Auto-start an edit intent once for a signed-in viewer and clear it from the URL. */
export function useEditIntentAutoStart(
  enabled: boolean,
  session: BffSession | null,
  trigger: () => Promise<void>,
): void {
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!enabled || autoStarted.current || session === null) return;
    if (new URLSearchParams(window.location.search).get('intent') !== 'edit') return;
    autoStarted.current = true;
    void trigger().then(() => clearIntent());
  }, [enabled, session, trigger]);
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

/** Render the discovery, loading or notice branch for a non-OpenDraft repository. */
function PlainRepositoryContent({
  route,
  discovery,
  discoveryError,
  canWrite,
}: {
  route: ReaderRoute;
  discovery: ProjectDiscovery | null;
  discoveryError: unknown;
  canWrite: boolean;
}) {
  if (discoveryError !== null) {
    return <LoadError error={discoveryError} returnTo={readerPath(route)} />;
  }
  if (discovery === null) return <p className="text-sm text-black">{READER_COPY.discovering}</p>;
  return (
    <NonCompliantNotice
      discovery={discovery}
      canWrite={canWrite}
      owner={route.owner}
      repo={route.repo}
    />
  );
}

/**
 * Render the loading indicator, load error, conversion panel or reader view.
 *
 * @param props - See {@link ReaderContentProps}.
 * @returns The content for the current reader state.
 */
export function ReaderContent({
  route,
  state,
  register,
  discovery,
  discoveryError,
  canWrite,
}: ReaderContentProps) {
  const { repo, error, loading } = state;
  if (loading) {
    return (
      <ReaderLoading
        phase={state.phase}
        owner={route.owner}
        repo={route.repo}
        firstVisit={state.firstVisit}
      />
    );
  }
  if (error !== null) return <LoadError error={error} returnTo={readerPath(route)} />;
  if (repo === null) return null;

  const banner = state.updateAvailable === null
    ? null
    : <ReaderUpdateBanner onRefresh={state.refresh} />;
  const body = repo.isOpenDraft ? (
    <OpenDraftContent
      route={route}
      state={state}
      repo={repo}
      discovery={discovery}
      register={register}
    />
  ) : (
    <PlainRepositoryContent
      route={route}
      discovery={discovery}
      discoveryError={discoveryError}
      canWrite={canWrite}
    />
  );
  return (
    <>
      {banner}
      {body}
    </>
  );
}

export default ReaderContent;

/**
 * Reader page for a GitHub repository: the read-only manuscript view for an
 * OpenDraft project, the conversion panel for a plain repository, and dedicated
 * rate-limit and not-found messages.
 *
 * Every GitHub, git and session operation is injected. The default dependencies
 * lazily import the git implementation (and its Buffer polyfill) only when a
 * conversion starts, so the anonymous reader path never loads isomorphic-git.
 */

import { useEffect, useState } from 'react';
import type { BffSession, SessionState } from '../github/bff-client';
import {
  createPullRequest,
  forkRepo,
  getRepoPermissions,
  getSession as fetchSession,
  getSessionState,
  loginUrl,
  logout as signOut,
} from '../github/bff-client';
import { ManuscriptView } from '../components/ManuscriptView';
import { ConvertPanel } from './ConvertPanel';
import { ReaderHeader } from './ReaderHeader';
import {
  NotFoundError,
  RateLimitedError,
  loadPublicSnapshot,
  resolveCommit,
} from './github-public';
import { cloneViaRelay, loadRepo as loadReaderRepo } from './load-repo';
import type { LoadedRepo } from './load-repo';
import { loadSnapshot, saveSnapshot } from './reader-cache';
import type { ReaderRoute } from './route';
import { convertRepository } from './convert';
import type { ConvertDeps, ConvertInput, ConvertResult } from './convert';

/** Reader page dependencies, injectable for tests. */
export interface ReaderPageDeps {
  /** Load the repository at a route into a read-only workspace. */
  loadRepo: (route: ReaderRoute) => Promise<LoadedRepo>;
  /** Read the current BFF session and whether login is configured. */
  getSessionState: () => Promise<SessionState>;
  /** Clear the BFF session. */
  logout: () => Promise<void>;
  /** Convert a plain repository into an OpenDraft project. */
  convert: (input: ConvertInput) => Promise<ConvertResult>;
}

/** Props for {@link ReaderPage}. */
export interface ReaderPageProps {
  /** Repository owner, name and optional ref from the URL. */
  route: ReaderRoute;
  /** Injected dependencies; defaults to the live GitHub and BFF clients. */
  deps?: ReaderPageDeps;
}

type GitModule = typeof import('@opendraft/git');
type GitFs = Parameters<GitModule['commitFilesOnBranch']>[0];
type GitRemoteOptions = ConstructorParameters<GitModule['RemoteGit']>[0];
/** Return the reader path (`/{owner}/{repo}[/tree/{ref}]`) for a route. */
function readerPath(route: ReaderRoute): string {
  const base = `/${route.owner}/${route.repo}`;
  return route.ref === undefined ? base : `${base}/tree/${route.ref}`;
}

/** Convert lazily with the browser git client, Buffer polyfill and scaffold. */
async function convertWithGit(input: ConvertInput): Promise<ConvertResult> {
  await import('../github/buffer-polyfill');
  const git = await import('@opendraft/git');
  const http = (
    await import('../../../../packages/git/node_modules/isomorphic-git/http/web/index.js')
  ).default;
  const { PROTOCOL } = await import('../project/scaffold');

  const deps: ConvertDeps = {
    getRepoPermissions: (owner, repo) => getRepoPermissions(owner, repo),
    forkRepo: (owner, repo) => forkRepo(owner, repo),
    createPullRequest: (owner, repo, pullRequest) =>
      createPullRequest(owner, repo, pullRequest),
    cloneRepo: async (url) => {
      const remote = new git.RemoteGit({ http });
      await remote.clone(url);
      return { fs: remote.fs, dir: remote.dir };
    },
    relayUrl: (owner, repo) => git.relayUrl(window.location.origin, owner, repo),
    push: async (fs, dir, url, branch) => {
      const remote = new git.RemoteGit({ http, fs: fs as GitRemoteOptions['fs'], dir });
      await remote.push(url, branch);
    },
    protocol: PROTOCOL,
    commitFilesOnBranch: (fs, dir, opts) =>
      git.commitFilesOnBranch(fs as GitFs, dir, opts),
    readWorkingFiles: (fs, dir) => git.readWorkingFiles(fs as GitFs, dir),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };

  return convertRepository(input, deps);
}

/** Live reader dependencies backed by the anonymous API, relay and BFF. */
const defaultDeps: ReaderPageDeps = {
  loadRepo: (route) =>
    loadReaderRepo(route, {
      resolveCommit,
      loadPublicSnapshot,
      cache: { loadSnapshot, saveSnapshot },
      getSession: () => fetchSession(),
      cloneViaRelay,
    }),
  getSessionState: () => getSessionState(),
  logout: () => signOut(),
  convert: convertWithGit,
};

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

/** Reader state loaded from the route and injected dependencies. */
interface ReaderState {
  session: BffSession | null;
  loginEnabled: boolean;
  repo: LoadedRepo | null;
  error: unknown;
  loading: boolean;
  selected: number;
  select: (index: number) => void;
  logout: () => void;
}

/** Load the session and repository snapshot for a route. */
function useReaderState(route: ReaderRoute, deps: ReaderPageDeps): ReaderState {
  const [session, setSession] = useState<BffSession | null>(null);
  const [loginEnabled, setLoginEnabled] = useState(true);
  const [repo, setRepo] = useState<LoadedRepo | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRepo(null);
    setSelected(0);

    void (async () => {
      try {
        const [nextState, loaded] = await Promise.all([deps.getSessionState(), deps.loadRepo(route)]);
        if (cancelled) return;
        setSession(nextState.session);
        setLoginEnabled(nextState.loginEnabled);
        setRepo(loaded);
      } catch (thrown) {
        if (!cancelled) setError(thrown);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [route.owner, route.repo, route.ref, deps]);

  const logout = (): void => {
    void (async () => {
      try {
        await deps.logout();
      } finally {
        setSession(null);
      }
    })();
  };

  return { session, loginEnabled, repo, error, loading, selected, select: setSelected, logout };
}

/** Props for {@link ReaderContent}. */
interface ReaderContentProps {
  route: ReaderRoute;
  state: ReaderState;
  convert: () => Promise<ConvertResult>;
}

/** Render the loading indicator, load error, conversion panel or reader view. */
function ReaderContent({ route, state, convert }: ReaderContentProps) {
  const { session, loginEnabled, repo, error, loading, selected, select } = state;
  const returnTo = readerPath(route);

  if (loading) return <p className="text-sm text-black">Loading…</p>;
  if (error !== null) return <LoadError error={error} returnTo={returnTo} />;
  if (repo === null) return null;
  if (!repo.isOpenDraft) {
    return <ConvertPanel session={session} returnTo={returnTo} convert={convert} loginEnabled={loginEnabled} />;
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

/**
 * Render the reader page for a repository.
 *
 * @param props - See {@link ReaderPageProps}.
 * @returns The header plus the loading indicator, error message, conversion
 *          panel or read-only manuscript view.
 */
export function ReaderPage({ route, deps = defaultDeps }: ReaderPageProps) {
  const state = useReaderState(route, deps);
  /** Run the conversion for the signed-in viewer. */
  const handleConvert = async (): Promise<ConvertResult> => {
    if (state.session === null) throw new Error('Sign in to convert this repository.');
    return deps.convert({ owner: route.owner, repo: route.repo, session: state.session });
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <ReaderHeader
        session={state.session}
        returnTo={readerPath(route)}
        onLogout={state.logout}
        loginEnabled={state.loginEnabled}
      />
      <main className="flex flex-1 flex-col gap-4 p-4">
        <ReaderContent route={route} state={state} convert={handleConvert} />
      </main>
    </div>
  );
}

export default ReaderPage;

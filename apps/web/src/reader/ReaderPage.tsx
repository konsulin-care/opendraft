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
import type { InitDecisions } from '@opendraft/manuscript';
import type { BffSession, SessionState } from '../github/bff-client';
import {
  createPullRequest,
  forkRepo,
  getRepoPermissions,
  getSession as fetchSession,
  getSessionState,
  logout as signOut,
} from '../github/bff-client';
import { ReaderHeader } from './ReaderHeader';
import { loadPublicSnapshot, resolveCommit } from './github-public';
import { cloneViaRelay, loadRepo as loadReaderRepo } from './load-repo';
import type { LoadedRepo } from './load-repo';
import { loadSnapshot, saveSnapshot } from './reader-cache';
import type { ReaderRoute } from './route';
import { ReaderContent } from './ReaderContent';
import type { ReaderState } from './ReaderContent';
import { convertRepository } from './convert';
import type { ConvertDeps, ConvertInput, ConvertResult } from './convert';
import { registerManuscripts } from './register';
import type { RegisterManuscriptsInput } from './register';

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
  /** Register unlisted manuscript ids in an existing project. */
  register: (ids: string[]) => Promise<ConvertResult>;
}

/** Reader page dependencies without the route-dependent register hook. */
type ReaderPageBaseDeps = Omit<ReaderPageDeps, 'register'>;

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

/** Build dependencies on the browser git client, Buffer polyfill and protocol. */
async function browserConvertDeps(): Promise<ConvertDeps> {
  await import('../github/buffer-polyfill');
  const git = await import('@opendraft/git');
  const http = (
    await import('../../../../packages/git/node_modules/isomorphic-git/http/web/index.js')
  ).default;
  const { PROTOCOL } = await import('../project/scaffold');

  return {
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
}

/** Convert lazily with the browser git client, Buffer polyfill and protocol. */
async function convertWithGit(input: ConvertInput): Promise<ConvertResult> {
  return convertRepository(input, await browserConvertDeps());
}

/** Register manuscripts lazily with the browser git client and protocol. */
async function registerWithGit(input: RegisterManuscriptsInput): Promise<ConvertResult> {
  return registerManuscripts(input, await browserConvertDeps());
}

/** Live reader dependencies backed by the anonymous API, relay and BFF. */
const defaultDeps: ReaderPageBaseDeps = {
  loadRepo: (route) =>
    loadReaderRepo(route, {
      resolveCommit,
      loadPublicSnapshot,
      cache: { loadSnapshot, saveSnapshot },
      getSession: () => fetchSession(),
      cloneViaRelay,
    }),
  getSessionState: () => getSessionState(),
  logout: async () => {
    await signOut();
    const [{ projectRegistry }, { purgePrivateProjects }] = await Promise.all([
      import('../hooks/useProjects'),
      import('../suggest/purge'),
    ]);
    await purgePrivateProjects(projectRegistry);
  },
  convert: convertWithGit,
};

/** Load the session and repository snapshot for a route. */
function useReaderState(route: ReaderRoute, deps: ReaderPageBaseDeps): ReaderState {
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

/**
 * Render the reader page for a repository.
 *
 * @param props - See {@link ReaderPageProps}.
 * @returns The header plus the loading indicator, error message, conversion
 *          panel or read-only manuscript view.
 */
export function ReaderPage({ route, deps }: ReaderPageProps) {
  const baseDeps = deps ?? defaultDeps;
  const state = useReaderState(route, baseDeps);

  /** Run the conversion for the signed-in viewer with its decisions. */
  const handleConvert = async (decisions: InitDecisions): Promise<ConvertResult> => {
    if (state.session === null) throw new Error('Sign in to convert this repository.');
    return baseDeps.convert({
      owner: route.owner,
      repo: route.repo,
      session: state.session,
      decisions,
    });
  };

  /** Register unlisted manuscripts for the signed-in viewer. */
  const handleRegister = async (ids: string[]): Promise<ConvertResult> => {
    if (state.session === null) throw new Error('Sign in to register manuscripts.');
    if (deps !== undefined) return deps.register(ids);
    return registerWithGit({
      owner: route.owner,
      repo: route.repo,
      session: state.session,
      ids,
    });
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
        <ReaderContent
          route={route}
          state={state}
          convert={handleConvert}
          register={handleRegister}
        />
      </main>
    </div>
  );
}

export default ReaderPage;

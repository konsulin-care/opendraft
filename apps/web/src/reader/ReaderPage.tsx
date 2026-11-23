/**
 * Reader page for a GitHub repository: the read-only manuscript view for an
 * OpenDraft project, the conversion panel for a plain repository, and dedicated
 * rate-limit and not-found messages. Every GitHub, git and session operation
 * is injected so the anonymous reader path never loads isomorphic-git.
 */

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { InitDecisions } from '@opendraft/manuscript';
import type { BffSession, RepoPermissions, SessionState } from '../github/bff-client';
import { createPullRequest, forkRepo, getRepoPermissions, getSession as fetchSession, getSessionState, logout as signOut } from '../github/bff-client';
import { ReaderHeader } from './ReaderHeader';
import { loadPublicSnapshot, resolveCommit } from './github-public';
import { cloneViaRelay, loadRepo as loadReaderRepo } from './load-repo';
import type { LoadedRepo } from './load-repo';
import { loadSnapshot, saveSnapshot } from './reader-cache';
import { readerManuscript } from './route';
import type { ReaderRoute } from './route';
import { ReaderContent } from './ReaderContent';
import type { ReaderState } from './ReaderContent';
import { convertRepository } from './convert';
import type { ConvertDeps, ConvertInput, ConvertResult } from './convert';
import { registerManuscripts } from './register';
import type { RegisterManuscriptsInput } from './register';
import { clearIntent } from './intent-url';
import { ReaderAction } from './ReaderAction';
import { useRepoAccess } from './use-repo-access';
import { useSuggestEdit } from './use-suggest-edit';
import type { StartSuggestionInput, StartSuggestionResult } from '../suggest/start';

export interface ReaderPageDeps {
  loadRepo: (route: ReaderRoute) => Promise<LoadedRepo>;
  getSessionState: () => Promise<SessionState>;
  logout: () => Promise<void>;
  convert: (input: ConvertInput) => Promise<ConvertResult>;
  register: (ids: string[]) => Promise<ConvertResult>;
  getAccess?: (owner: string, repo: string) => Promise<RepoPermissions>;
  start?: (input: StartSuggestionInput) => Promise<StartSuggestionResult>;
  navigate?: (path: string) => void;
}

type ReaderPageBaseDeps = Omit<ReaderPageDeps, 'register'>;

export interface ReaderPageProps {
  route: ReaderRoute;
  deps?: ReaderPageDeps;
  action?: ReactNode;
}

type GitModule = typeof import('@opendraft/git');
type GitFs = Parameters<GitModule['commitFilesOnBranch']>[0];
type GitRemoteOptions = ConstructorParameters<GitModule['RemoteGit']>[0];

function readerPath(route: ReaderRoute): string {
  const base = `/${route.owner}/${route.repo}`;
  return route.ref === undefined ? base : `${base}/tree/${route.ref}`;
}

function locationManuscript(): string | undefined {
  return typeof window === 'undefined' ? undefined : readerManuscript(window.location.search);
}

function resolveCurrent(
  manuscripts: LoadedRepo['manuscripts'],
  requested: string | undefined,
): LoadedRepo['manuscripts'][number] | undefined {
  if (manuscripts.length === 1) return manuscripts[0];
  if (requested === undefined) return undefined;
  return manuscripts.find((manuscript) => manuscript.id === requested);
}

/** Track the manuscript chosen in the header switcher and mirror it in the URL. */
function useReaderNavigation(route: ReaderRoute, manuscripts: LoadedRepo['manuscripts']): {
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

async function convertWithGit(input: ConvertInput): Promise<ConvertResult> {
  return convertRepository(input, await browserConvertDeps());
}

async function registerWithGit(input: RegisterManuscriptsInput): Promise<ConvertResult> {
  return registerManuscripts(input, await browserConvertDeps());
}

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

function useReaderState(route: ReaderRoute, deps: ReaderPageBaseDeps): ReaderState {
  const [session, setSession] = useState<BffSession | null>(null);
  const [loginEnabled, setLoginEnabled] = useState(true);
  const [repo, setRepo] = useState<LoadedRepo | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRepo(null);

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

  return { session, loginEnabled, repo, error, loading, logout };
}

function useReaderHandlers(
  route: ReaderRoute,
  deps: ReaderPageDeps | undefined,
  baseDeps: ReaderPageBaseDeps,
  session: BffSession | null,
): {
  handleConvert: (decisions: InitDecisions) => Promise<ConvertResult>;
  handleRegister: (ids: string[]) => Promise<ConvertResult>;
} {
  const handleConvert = async (decisions: InitDecisions): Promise<ConvertResult> => {
    if (session === null) throw new Error('Sign in to convert this repository.');
    return baseDeps.convert({ owner: route.owner, repo: route.repo, session, decisions });
  };

  const handleRegister = async (ids: string[]): Promise<ConvertResult> => {
    if (session === null) throw new Error('Sign in to register manuscripts.');
    if (deps !== undefined) return deps.register(ids);
    return registerWithGit({ owner: route.owner, repo: route.repo, session, ids });
  };

  return { handleConvert, handleRegister };
}

function useEditIntentAutoStart(
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

/** Render the reader page for a repository, with its main action in the header. */
export function ReaderPage({ route, deps, action }: ReaderPageProps) {
  const baseDeps = deps ?? defaultDeps;
  const state = useReaderState(route, baseDeps);
  const handlers = useReaderHandlers(route, deps, baseDeps, state.session);
  const manuscripts = state.repo?.manuscripts ?? [];
  const { current, contentRoute, navigateTo } = useReaderNavigation(route, manuscripts);
  const access = useRepoAccess({
    owner: route.owner, repo: route.repo, session: state.session,
    loginEnabled: state.loginEnabled, getAccess: baseDeps.getAccess,
  });
  const suggest = useSuggestEdit({
    route, session: state.session, loginEnabled: state.loginEnabled,
    getAccess: baseDeps.getAccess, start: baseDeps.start, navigate: baseDeps.navigate,
  });
  useEditIntentAutoStart(state.repo?.isOpenDraft === true, state.session, suggest.trigger);

  const headerAction = state.repo?.isOpenDraft === true ? (
    <ReaderAction
      kind="opendraft" access={access.access} status={suggest.status}
      intent={suggest.intent} error={suggest.error} route={route}
      manuscriptId={current?.id} onTrigger={() => void suggest.trigger()}
      onConvert={() => undefined} onClose={suggest.reset}
    />
  ) : action;

  return (
    <div className="flex min-h-dvh flex-col">
      <ReaderHeader
        session={state.session}
        returnTo={readerPath(route)}
        onLogout={state.logout}
        loginEnabled={state.loginEnabled}
        title={current?.id ?? 'All manuscripts'}
        manuscripts={manuscripts.map((manuscript) => ({ id: manuscript.id, title: manuscript.id }))}
        selectedId={current?.id}
        onSelect={(id) => navigateTo(id)}
        onSelectAll={() => navigateTo(null)}
        action={headerAction}
      />
      <main className="flex flex-1 flex-col gap-4 p-4">
        <ReaderContent
          route={contentRoute} state={state}
          convert={handlers.handleConvert} register={handlers.handleRegister}
        />
      </main>
    </div>
  );
}

export default ReaderPage;

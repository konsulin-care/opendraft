/**
 * Reader page: reads a GitHub repository, renders the shared header and body,
 * and owns the conversion dialog. All GitHub, git and session work is injected.
 */

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { InitDecisions, ProjectDiscovery } from '@opendraft/manuscript';
import { normalizeManuscriptId } from '@opendraft/manuscript';
import type { BffSession, RepoPermissions, SessionState } from '../github/bff-client';
import { createPullRequest, forkRepo, getRepoPermissions, getSession as fetchSession, getSessionState, logout as signOut } from '../github/bff-client';
import { ReaderHeader } from './ReaderHeader';
import { loadPublicSnapshot, resolveCommit } from './github-public';
import { cloneViaRelay, loadRepo as loadReaderRepo } from './load-repo';
import type { LoadedRepo } from './load-repo';
import { loadSnapshot, saveSnapshot } from './reader-cache';
import type { ReaderRoute } from './route';
import { ReaderContent, readerPath, useDiscovery, useEditIntentAutoStart, useReaderNavigation } from './ReaderContent';
import type { ReaderState } from './ReaderContent';
import { ConvertDialog } from './ConvertDialog';
import { convertRepository } from './convert';
import type { ConvertDeps, ConvertInput, ConvertResult } from './convert';
import { registerManuscripts } from './register';
import type { RegisterManuscriptsInput } from './register';
import { ReaderAction } from './ReaderAction';
import type { EditIntent } from '../suggest/edit-intent';
import { useRepoAccess } from './use-repo-access';
import { useSuggestEdit } from './use-suggest-edit';
import type { SuggestEditController } from './use-suggest-edit';
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

async function browserConvertDeps(): Promise<ConvertDeps> {
  await import('../github/buffer-polyfill');
  const git = await import('@opendraft/git');
  const http = (await import('../../../../packages/git/node_modules/isomorphic-git/http/web/index.js')).default;
  const { PROTOCOL } = await import('../project/scaffold');
  return {
    getRepoPermissions: (owner, repo) => getRepoPermissions(owner, repo),
    forkRepo: (owner, repo) => forkRepo(owner, repo),
    createPullRequest: (owner, repo, pullRequest) => createPullRequest(owner, repo, pullRequest),
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
    commitFilesOnBranch: (fs, dir, opts) => git.commitFilesOnBranch(fs as GitFs, dir, opts),
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
  loadRepo: (route) => loadReaderRepo(route, {
    resolveCommit, loadPublicSnapshot, cache: { loadSnapshot, saveSnapshot },
    getSession: () => fetchSession(), cloneViaRelay,
  }),
  getSessionState: () => getSessionState(),
  logout: async () => {
    await signOut();
    const [{ projectRegistry }, { purgePrivateProjects }] = await Promise.all([
      import('../hooks/useProjects'), import('../suggest/purge'),
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
    setLoading(true); setError(null); setRepo(null);
    void (async () => {
      try {
        const [nextState, loaded] = await Promise.all([deps.getSessionState(), deps.loadRepo(route)]);
        if (cancelled) return;
        setSession(nextState.session); setLoginEnabled(nextState.loginEnabled); setRepo(loaded);
      } catch (thrown) {
        if (!cancelled) setError(thrown);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [route.owner, route.repo, route.ref, deps]);
  const logout = (): void => {
    void (async () => {
      try { await deps.logout(); } finally { setSession(null); }
    })();
  };
  return { session, loginEnabled, repo, error, loading, logout };
}

function useReaderHandlers(
  route: ReaderRoute,
  deps: ReaderPageDeps | undefined,
  baseDeps: ReaderPageBaseDeps,
  session: BffSession | null,
): { handleConvert: (decisions: InitDecisions) => Promise<ConvertResult>; handleRegister: (ids: string[]) => Promise<ConvertResult> } {
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

/** Props of the conversion dialog controller. */
interface ConvertActionState {
  open: boolean;
  intent: EditIntent | null;
  trigger: () => void;
  closeDialog: () => void;
  closeIntent: () => void;
}
function useConvertAction(
  route: ReaderRoute,
  session: BffSession | null,
  loginEnabled: boolean,
): ConvertActionState {
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<EditIntent | null>(null);
  useEffect(() => { setOpen(false); setIntent(null); }, [route.owner, route.repo]);
  const trigger = (): void => {
    if (!loginEnabled) setIntent({ kind: 'blocked', reason: 'login_disabled' });
    else if (session === null) setIntent({ kind: 'sign-in' });
    else { setIntent(null); setOpen(true); }
  };
  return { open, intent, trigger, closeDialog: () => setOpen(false), closeIntent: () => setIntent(null) };
}

function buildHeaderAction(props: {
  repo: LoadedRepo | null;
  action: ReactNode;
  access: RepoPermissions | null;
  suggest: SuggestEditController;
  convert: ConvertActionState;
  route: ReaderRoute;
  manuscriptId: string | undefined;
}): ReactNode {
  const { repo, action, access, suggest, convert, route, manuscriptId } = props;
  if (repo === null) return action;
  if (!repo.isOpenDraft) {
    return (
      <ReaderAction kind="non-compliant" access={access} status="idle" intent={convert.intent}
        error={null} route={route} manuscriptId={manuscriptId}
        onTrigger={() => undefined} onConvert={convert.trigger} onClose={convert.closeIntent} />
    );
  }
  return (
    <ReaderAction kind="opendraft" access={access} status={suggest.status}
      intent={suggest.intent} error={suggest.error} route={route}
      manuscriptId={manuscriptId} onTrigger={() => void suggest.trigger()}
      onConvert={() => undefined} onClose={suggest.reset} />
  );
}

/** Props shared by the reader page shell and its header/content split. */
interface ReaderLayoutProps {
  route: ReaderRoute;
  state: ReaderState;
  current: LoadedRepo['manuscripts'][number] | undefined;
  manuscripts: LoadedRepo['manuscripts'];
  navigateTo: (id: string | null) => void;
  headerAction: ReactNode;
  contentRoute: ReaderRoute;
  handlers: ReturnType<typeof useReaderHandlers>;
  discovery: ProjectDiscovery | null;
  discoveryError: unknown;
  canWrite: boolean;
  convert: ConvertActionState;
}

/** Render the page shell: header, content and optional conversion dialog. */
function ReaderLayout(props: ReaderLayoutProps) {
  const { route, state, current, manuscripts, navigateTo, headerAction } = props;
  const { contentRoute, handlers, discovery, discoveryError, canWrite, convert } = props;
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
        <ReaderContent route={contentRoute} state={state} register={handlers.handleRegister}
          discovery={discovery} discoveryError={discoveryError} canWrite={canWrite} />
      </main>
      {convert.open && discovery !== null && state.repo?.isOpenDraft === false ? (
        <ConvertDialog discovery={discovery} defaultId={normalizeManuscriptId(route.repo)}
          convert={handlers.handleConvert} onClose={convert.closeDialog} />
      ) : null}
    </div>
  );
}

/** Compose the reader page state, handlers and header action for a route. */
function useReaderPageModel(route: ReaderRoute, deps: ReaderPageDeps | undefined, action: ReactNode) {
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
  const convert = useConvertAction(route, state.session, state.loginEnabled);
  const { discovery, error: discoveryError } = useDiscovery(state.repo);
  useEditIntentAutoStart(state.repo?.isOpenDraft === true, state.session, suggest.trigger);
  const headerAction = buildHeaderAction({
    repo: state.repo, action, access: access.access, suggest, convert, route, manuscriptId: current?.id,
  });
  return {
    state, handlers, manuscripts, current, contentRoute, navigateTo, headerAction,
    discovery, discoveryError, canWrite: access.access?.push === true, convert,
  };
}

/** Render the reader page for a repository, with its main action in the header. */
export function ReaderPage({ route, deps, action }: ReaderPageProps) {
  const model = useReaderPageModel(route, deps, action);
  return (
    <ReaderLayout route={route} state={model.state} current={model.current}
      manuscripts={model.manuscripts} navigateTo={model.navigateTo}
      headerAction={model.headerAction} contentRoute={model.contentRoute}
      handlers={model.handlers} discovery={model.discovery}
      discoveryError={model.discoveryError} canWrite={model.canWrite}
      convert={model.convert} />
  );
}

export default ReaderPage;

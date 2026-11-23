/**
 * "Suggest edits" entry point for the read-only reader.
 *
 * The component plans what an anonymous or signed-in viewer must do before
 * they can edit: sign in, install the GitHub App, or start/resume a suggestion
 * on a branch or fork. Every GitHub and git operation is injectable so the
 * screens can be tested without network access.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BffSession, RepoPermissions } from '../github/bff-client';
import { getRepoPermissions, installUrl, loginUrl } from '../github/bff-client';
import { planEditIntent } from '../suggest/edit-intent';
import type { EditIntent } from '../suggest/edit-intent';
import type { StartSuggestionInput, StartSuggestionResult } from '../suggest/start';
import type { ReaderRoute } from './route';

/** Key under which the editor stores the project to open on `/`. */
const ACTIVE_PROJECT_KEY = 'opendraft:active-project';

/** Props for {@link SuggestEdits}. */
export interface SuggestEditsProps {
  /** Repository owner, name and optional ref from the URL. */
  route: ReaderRoute;
  /** Signed-in session, or null for an anonymous viewer. */
  session: BffSession | null;
  /** Whether GitHub login is configured. */
  loginEnabled: boolean;
  /** URL query string, e.g. the reader's `window.location.search`. */
  search: string;
  /** Read repository permissions and installation state. */
  getAccess?: (owner: string, repo: string) => Promise<RepoPermissions>;
  /** Start or resume a suggestion from an accepted edit plan. */
  start?: (input: StartSuggestionInput) => Promise<StartSuggestionResult>;
  /** Navigate after the suggestion project is active. */
  navigate?: (path: string) => void;
}

/** Edit plan state and the trigger that computes it. */
interface EditIntentController {
  /** Current edit plan, or null before the viewer clicks the trigger. */
  intent: EditIntent | null;
  /** Whether a branch or fork suggestion is being prepared. */
  running: boolean;
  /** Error from access lookup or suggestion start. */
  error: string | null;
  /** Read access, plan the intent and start a suggestion when possible. */
  trigger: () => Promise<void>;
}

/** Read one URL query parameter from a search string. */
function queryValue(search: string, key: string): string | null {
  return new URLSearchParams(search).get(key);
}

/** Read a human-readable message from an unknown thrown value. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Build the reader path that carries the edit intent through auth round-trips. */
function intentPath(route: ReaderRoute): string {
  return `/${route.owner}/${route.repo}?intent=edit`;
}

/** Start a suggestion through the browser-wired dependencies. */
async function defaultStart(input: StartSuggestionInput): Promise<StartSuggestionResult> {
  const [{ createStartDeps }, { startSuggestion }] = await Promise.all([
    import('../suggest/browser-deps'),
    import('../suggest/start'),
  ]);
  return startSuggestion(input, await createStartDeps());
}

/** Navigate in the browser after the project was activated. */
function defaultNavigate(path: string): void {
  window.location.assign(path);
}

/** Render the sign-in screen with the Google sign-up hint. */
function SignInScreen({ route }: { route: ReaderRoute }) {
  return (
    <section className="flex flex-col gap-2 rounded-md border border-outline p-4">
      <p className="text-sm text-black">
        Suggestions are saved under your free GitHub account. No account? You can create one
        with Google in a few seconds.
      </p>
      <a
        href={loginUrl(intentPath(route))}
        className="self-start rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white"
      >
        Sign in with GitHub
      </a>
    </section>
  );
}

/** Render the install screen for a personal or upstream installation. */
function InstallScreen({
  route,
  scope,
}: {
  route: ReaderRoute;
  scope: 'personal' | 'upstream';
}) {
  return (
    <section className="flex flex-col gap-2 rounded-md border border-outline p-4">
      {scope === 'upstream' ? (
        <p className="text-sm text-black">
          A repository owner must install OpenDraft before anyone can suggest edits.
        </p>
      ) : null}
      <p className="text-sm text-black">
        Install OpenDraft and choose &lsquo;All repositories&rsquo; so GitHub can create your
        copy when you suggest edits.
      </p>
      <a
        href={installUrl(intentPath(route))}
        className="self-start rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white"
      >
        Install OpenDraft
      </a>
    </section>
  );
}

/** Return the plain-language explanation for a blocked plan. */
function blockedMessage(reason: string): string {
  switch (reason) {
    case 'upstream_not_installed':
      return 'The owners have not enabled OpenDraft suggestions.';
    case 'fork_disabled':
      return 'Ask a maintainer to add you as a collaborator.';
    default:
      return 'OpenDraft suggestions are not available on this server.';
  }
}

/** Render the blocked explanation. */
function BlockedScreen({ reason }: { reason: string }) {
  return (
    <section className="flex flex-col gap-2 rounded-md border border-outline p-4">
      <p className="text-sm text-black">{blockedMessage(reason)}</p>
    </section>
  );
}

/** Start a suggestion and make its project active for the editor at `/`. */
async function startAndActivate(
  start: (input: StartSuggestionInput) => Promise<StartSuggestionResult>,
  input: StartSuggestionInput,
  navigate: (path: string) => void,
): Promise<void> {
  const result = await start(input);
  localStorage.setItem(ACTIVE_PROJECT_KEY, result.projectId);
  navigate('/');
}

/** Manage edit plan state, access lookup and suggestion start. */
function useSuggestEdit({
  route,
  session,
  loginEnabled,
  getAccess,
  start,
  navigate,
}: {
  route: ReaderRoute;
  session: BffSession | null;
  loginEnabled: boolean;
  getAccess: (owner: string, repo: string) => Promise<RepoPermissions>;
  start: (input: StartSuggestionInput) => Promise<StartSuggestionResult>;
  navigate: (path: string) => void;
}): EditIntentController {
  const [intent, setIntent] = useState<EditIntent | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trigger = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const access =
        session === null || !loginEnabled ? null : await getAccess(route.owner, route.repo);
      const plan = planEditIntent({ loginEnabled, session, access });
      setIntent(plan);
      if (plan.kind !== 'branch' && plan.kind !== 'fork') return;
      if (session === null || access === null) {
        throw new Error('Sign in to suggest edits.');
      }
      setRunning(true);
      try {
        await startAndActivate(
          start,
          { upstream: { owner: route.owner, repo: route.repo }, session, plan: plan.kind, access },
          navigate,
        );
      } finally {
        setRunning(false);
      }
    } catch (thrown) {
      setRunning(false);
      setError(errorMessage(thrown));
    }
  }, [getAccess, loginEnabled, navigate, route.owner, route.repo, session, start]);

  return { intent, running, error, trigger };
}

/** Render the trigger or the screen for the current edit plan. */
function PlanStatus({
  route,
  running,
  intent,
  onTrigger,
}: {
  route: ReaderRoute;
  running: boolean;
  intent: EditIntent | null;
  onTrigger: () => void;
}) {
  if (running) return <p className="text-sm text-black">Preparing your copy…</p>;
  if (intent === null) {
    return (
      <button
        type="button"
        onClick={onTrigger}
        className="self-start rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white"
      >
        Suggest edits
      </button>
    );
  }
  if (intent.kind === 'sign-in') return <SignInScreen route={route} />;
  if (intent.kind === 'install') return <InstallScreen route={route} scope={intent.scope} />;
  if (intent.kind === 'blocked') return <BlockedScreen reason={intent.reason} />;
  return <p className="text-sm text-black">Preparing your copy…</p>;
}

/**
 * Render the "Suggest edits" trigger or the screen for the current edit plan.
 *
 * Clicking the trigger reads repository access and calls {@link planEditIntent}.
 * A `?intent=edit` query parameter with a signed-in viewer starts a branch or
 * fork suggestion automatically, then activates its project and opens `/`.
 *
 * @param props - See {@link SuggestEditsProps}.
 * @returns The trigger, sign-in, install, blocked or preparing screen.
 */
export function SuggestEdits({
  route,
  session,
  loginEnabled,
  search,
  getAccess = getRepoPermissions,
  start = defaultStart,
  navigate = defaultNavigate,
}: SuggestEditsProps) {
  const { intent, running, error, trigger } = useSuggestEdit({
    route,
    session,
    loginEnabled,
    getAccess,
    start,
    navigate,
  });
  const autoStarted = useRef(false);
  const authError = queryValue(search, 'auth_error');
  const wantsEdit = queryValue(search, 'intent') === 'edit';

  useEffect(() => {
    if (autoStarted.current || !wantsEdit || session === null || authError !== null) return;
    autoStarted.current = true;
    void trigger();
  }, [authError, session, trigger, wantsEdit]);

  return (
    <div className="flex flex-col gap-3">
      {authError === 'unverified_email' ? (
        <p role="alert" className="text-sm text-error">
          Please confirm your email on GitHub, then try again.
        </p>
      ) : null}
      <PlanStatus
        route={route}
        running={running}
        intent={intent}
        onTrigger={() => void trigger()}
      />
      {error !== null ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default SuggestEdits;

/**
 * State controller for the reader's "Suggest edits" action.
 *
 * The hook plans what an anonymous or signed-in viewer must do before they can
 * edit and, when the plan is a branch or fork, starts the suggestion and opens
 * its project. Dependencies are injectable so the behaviour can be tested
 * without network access.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BffSession, RepoPermissions } from '../github/bff-client';
import { getRepoPermissions } from '../github/bff-client';
import { planEditIntent } from '../suggest/edit-intent';
import type { EditIntent } from '../suggest/edit-intent';
import type { StartSuggestionInput, StartSuggestionResult } from '../suggest/start';
import type { ReaderRoute } from './route';

/** Key under which the editor stores the project to open on `/`. */
const ACTIVE_PROJECT_KEY = 'opendraft:active-project';

/** Lifecycle of the suggest-edit action. */
export type SuggestEditStatus = 'idle' | 'checking' | 'starting';

/** Input of {@link useSuggestEdit}. */
export interface UseSuggestEditInput {
  /** Repository owner, name and optional ref from the URL. */
  route: ReaderRoute;
  /** Signed-in session, or null for an anonymous viewer. */
  session: BffSession | null;
  /** Whether GitHub login is configured. */
  loginEnabled: boolean;
  /** Read repository permissions and installation state. */
  getAccess?: (owner: string, repo: string) => Promise<RepoPermissions>;
  /** Start or resume a suggestion from an accepted edit plan. */
  start?: (input: StartSuggestionInput) => Promise<StartSuggestionResult>;
  /** Navigate after the suggestion project is active. */
  navigate?: (path: string) => void;
}

/** State and actions returned by {@link useSuggestEdit}. */
export interface SuggestEditController {
  /** Whether access is being checked or a suggestion is being prepared. */
  status: SuggestEditStatus;
  /** Current edit plan, or null before the viewer clicks the trigger. */
  intent: EditIntent | null;
  /** Error from access lookup or suggestion start. */
  error: string | null;
  /** Read access, plan the intent and start a suggestion when possible. */
  trigger: () => Promise<void>;
  /** Return to the idle state without an intent or error. */
  reset: () => void;
}

/** Runtime dependencies and state setters used by one trigger run. */
interface TriggerContext {
  route: ReaderRoute;
  session: BffSession | null;
  loginEnabled: boolean;
  getAccess: (owner: string, repo: string) => Promise<RepoPermissions>;
  start: (input: StartSuggestionInput) => Promise<StartSuggestionResult>;
  navigate: (path: string) => void;
  setStatus: (status: SuggestEditStatus) => void;
  setIntent: (intent: EditIntent | null) => void;
  setError: (error: string | null) => void;
}

/** Read a human-readable message from an unknown thrown value. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

/** Check access, plan the edit intent and start the suggestion when possible. */
async function performTrigger(context: TriggerContext): Promise<void> {
  const { route, session, loginEnabled, getAccess, start, navigate } = context;
  context.setError(null);
  context.setStatus('checking');

  try {
    const access =
      session === null || !loginEnabled ? null : await getAccess(route.owner, route.repo);
    const plan = planEditIntent({ loginEnabled, session, access });
    context.setIntent(plan);

    if (plan.kind !== 'branch' && plan.kind !== 'fork') {
      context.setStatus('idle');
      return;
    }
    if (session === null || access === null) {
      throw new Error('Sign in to suggest edits.');
    }

    context.setStatus('starting');
    await startAndActivate(
      start,
      { upstream: { owner: route.owner, repo: route.repo }, session, plan: plan.kind, access },
      navigate,
    );
    context.setIntent(null);
    context.setStatus('idle');
  } catch (thrown) {
    context.setError(errorMessage(thrown));
    context.setStatus('idle');
  }
}

/**
 * Manage suggest-edit state, access lookup, suggestion start and bfcache reset.
 *
 * A second trigger while the first is still checking or starting is ignored.
 * After a successful start the controller returns to `idle` with no intent, so
 * the button never keeps showing "Preparing your copy…". Restoring the page
 * from the back-forward cache resets the controller as well.
 *
 * @param input - Route, session and injectable GitHub/git operations.
 * @returns The current status, intent, error and the trigger/reset actions.
 */
export function useSuggestEdit({
  route,
  session,
  loginEnabled,
  getAccess = getRepoPermissions,
  start = defaultStart,
  navigate = defaultNavigate,
}: UseSuggestEditInput): SuggestEditController {
  const [status, setStatus] = useState<SuggestEditStatus>('idle');
  const [intent, setIntent] = useState<EditIntent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const reset = useCallback((): void => {
    busy.current = false;
    setStatus('idle');
    setIntent(null);
    setError(null);
  }, []);

  const trigger = useCallback(async (): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    try {
      await performTrigger({
        route,
        session,
        loginEnabled,
        getAccess,
        start,
        navigate,
        setStatus,
        setIntent,
        setError,
      });
    } finally {
      busy.current = false;
    }
  }, [getAccess, loginEnabled, navigate, route, session, start]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent): void => {
      if (event.persisted) reset();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [reset]);

  return { status, intent, error, trigger, reset };
}

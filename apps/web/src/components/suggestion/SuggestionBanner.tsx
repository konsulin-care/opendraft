/**
 * Editor banner describing the state of a GitHub-backed suggestion project.
 *
 * The banner is the editor-side counterpart of the reader's "Suggest edits"
 * flow: it reports the suggestion state, saves local edits to the viewer's
 * copy, submits or updates a suggestion, restarts a finished one, and resolves
 * a remote branch that moved on another device. Every action is injectable and
 * defaults to the browser wiring in `suggest/browser-deps`.
 */

import { useEffect, useMemo, useState } from 'react';
import type { ProjectRecord, WorkspaceAdapter } from '@opendraft/workspace';
import type { SaveOptions } from '../../suggest/save';
import type { SuggestionStatus } from '../../suggest/status';
import type { SubmitResult } from '../../suggest/submit';
import { createDefaultSuggestionActions, SubmitSuggestionDialog } from './SubmitSuggestionDialog';
import type { SuggestionActions, SubmitDialogInput } from './SubmitSuggestionDialog';

export type { SuggestionActions };

/** Props for {@link SuggestionBanner}. */
export interface SuggestionBannerProps {
  /** Active project; only GitHub sources render a banner. */
  project: ProjectRecord;
  /** Workspace of the active project. */
  workspace: WorkspaceAdapter;
  /** Injected actions; defaults to the browser-backed suggestion flow. */
  actions?: SuggestionActions;
}

type GitHubSource = Extract<ProjectRecord['source'], { kind: 'github' }>;

const BUTTON_CLASS =
  'rounded-md bg-black px-3 py-1 text-sm font-medium text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50';
const SECONDARY_BUTTON_CLASS =
  'rounded-md border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50';
const UPSTREAM_MOVED_MESSAGE =
  'The original has changed since you started; your suggestion may need review.';

/** Actions for one suggestion state. */
interface ActionsProps {
  status: SuggestionStatus | null;
  busy: boolean;
  onSave: (options?: SaveOptions) => void;
  onSubmit: () => void;
  onRestart: () => void;
  onPullLatest: () => void;
}

/** Render the buttons for the current suggestion state. */
function BannerActions({ status, busy, onSave, onSubmit, onRestart, onPullLatest }: ActionsProps) {
  const state = status?.state ?? null;
  if (state === 'merged' || state === 'closed' || state === 'branch-deleted') {
    return (
      <button type="button" onClick={onRestart} disabled={busy} className={BUTTON_CLASS}>
        Start a new suggestion
      </button>
    );
  }
  if (state === 'remote-moved') {
    return (
      <>
        <button type="button" onClick={onPullLatest} disabled={busy} className={BUTTON_CLASS}>
          Use the latest from GitHub
        </button>
        <button type="button" onClick={() => onSave({ overwrite: true })} disabled={busy}
          className={SECONDARY_BUTTON_CLASS}>
          Keep this device&apos;s version
        </button>
      </>
    );
  }
  return (
    <>
      <button type="button" onClick={() => onSave()} disabled={busy} className={SECONDARY_BUTTON_CLASS}>
        Save to my copy
      </button>
      <button type="button" onClick={onSubmit} disabled={busy} className={BUTTON_CLASS}>
        {state === 'open' ? 'Update suggestion' : 'Submit suggestion'}
      </button>
    </>
  );
}

/** Render the status line for the current suggestion state. */
function BannerStatus({ status }: { status: SuggestionStatus | null }) {
  if (status === null) return null;
  if (status.state === 'open') {
    return (
      <a href={status.url} target="_blank" rel="noreferrer" className="text-sm text-blue-700 underline">
        {`Suggestion #${status.number} is open`}
      </a>
    );
  }
  if (status.state === 'draft') {
    return <span className="text-sm text-gray-700">Not submitted yet</span>;
  }
  return null;
}

/** Notice and error messages shown under the banner actions. */
function BannerMessages({ notice, error }: { notice: string | null; error: string | null }) {
  return (
    <>
      {notice !== null ? (
        <p role="status" className="w-full text-sm text-gray-700">{notice}</p>
      ) : null}
      {error !== null ? (
        <p role="alert" className="w-full text-sm text-red-700">{error}</p>
      ) : null}
    </>
  );
}

/** Read the remote suggestion state once per resolved action set. */
function useSuggestionCheck(
  kind: ProjectRecord['source']['kind'],
  resolved: SuggestionActions,
  onStatus: (status: SuggestionStatus | null) => void,
  onError: (message: string) => void,
): void {
  useEffect(() => {
    if (kind !== 'github') return undefined;
    let cancelled = false;
    resolved.check().then(
      (next) => {
        if (!cancelled) onStatus(next);
      },
      (thrown: unknown) => {
        if (!cancelled) onError(thrown instanceof Error ? thrown.message : String(thrown));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [kind, resolved, onStatus, onError]);
}

/** Busy flag, error message and guarded runner shared by banner actions. */
function useSuggestionRunner() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

/** Build the save handler for the current banner state. */
function createSaveHandler(
  resolved: SuggestionActions,
  run: (action: () => Promise<void>) => Promise<void>,
  setNotice: (message: string | null) => void,
  setStatus: (status: SuggestionStatus | null) => void,
): (options?: SaveOptions) => void {
  return (options) => {
    void run(async () => {
      setNotice(null);
      const result = await resolved.save(options);
      if (result.kind === 'saved') {
        setNotice(result.upstreamMoved ? UPSTREAM_MOVED_MESSAGE : 'Saved to your copy.');
      } else if (result.kind === 'remote-moved') {
        setStatus({ state: 'remote-moved' });
      } else {
        setNotice('No local changes to save.');
      }
    });
  };
}

/** Build the submit handler that mirrors a sent suggestion in the banner. */
function createSubmitHandler(
  resolved: SuggestionActions,
  setError: (message: string | null) => void,
  setStatus: (status: SuggestionStatus | null) => void,
): (input: SubmitDialogInput) => Promise<SubmitResult> {
  return async (input) => {
    setError(null);
    const result = await resolved.submit(input);
    if (result.kind === 'created' || result.kind === 'updated') {
      setStatus({ state: 'open', number: result.number, url: result.url });
    }
    return result;
  };
}

/** Build the restart handler for a finished suggestion. */
function createRestartHandler(
  resolved: SuggestionActions,
  run: (action: () => Promise<void>) => Promise<void>,
  setNotice: (message: string | null) => void,
  setStatus: (status: SuggestionStatus | null) => void,
): () => void {
  return () => {
    void run(async () => {
      setNotice(null);
      await resolved.restart();
      setStatus({ state: 'local-only' });
    });
  };
}

/** Build the pull-latest handler for a remotely moved suggestion. */
function createPullLatestHandler(
  resolved: SuggestionActions,
  run: (action: () => Promise<void>) => Promise<void>,
  setNotice: (message: string | null) => void,
  setStatus: (status: SuggestionStatus | null) => void,
): () => void {
  return () => {
    void run(async () => {
      setNotice(null);
      await resolved.pullLatest();
      setStatus({ state: 'draft' });
    });
  };
}

interface BannerLayoutProps extends ActionsProps {
  source: GitHubSource;
  notice: string | null;
  error: string | null;
  dialogOpen: boolean;
  onCloseDialog: () => void;
  onDialogSubmit: (input: SubmitDialogInput) => Promise<SubmitResult>;
}

/** Visual banner once the project is known to be GitHub-backed. */
function BannerLayout({
  source, status, notice, error, busy, dialogOpen,
  onCloseDialog, onSave, onSubmit, onDialogSubmit, onRestart, onPullLatest,
}: BannerLayoutProps) {
  return (
    <section data-testid="suggestion-banner"
      className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2">
      <p className="mr-auto text-sm text-gray-800">
        {`Editing your copy of ${source.upstream.owner}/${source.upstream.repo}. Changes are saved in this browser.`}
      </p>
      <BannerStatus status={status} />
      <BannerActions status={status} busy={busy} onSave={onSave} onSubmit={onSubmit}
        onRestart={onRestart} onPullLatest={onPullLatest} />
      <BannerMessages notice={notice} error={error} />
      <SubmitSuggestionDialog isOpen={dialogOpen} onClose={onCloseDialog} onSubmit={onDialogSubmit} />
    </section>
  );
}

/**
 * Editor banner for a GitHub suggestion project.
 *
 * Renders nothing for a local project. For a GitHub source it explains where
 * edits are saved, shows the remote suggestion state and offers the matching
 * actions.
 *
 * @param props - See {@link SuggestionBannerProps}.
 * @returns The banner, or null for a local project.
 */
export function SuggestionBanner({ project, actions }: SuggestionBannerProps) {
  const source = project.source;
  const resolved = useMemo(
    () => actions ?? createDefaultSuggestionActions(project),
    [actions, project],
  );
  const [status, setStatus] = useState<SuggestionStatus | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { busy, error, setError, run } = useSuggestionRunner();
  useSuggestionCheck(source.kind, resolved, setStatus, setError);
  if (source.kind !== 'github') return null;
  return (
    <BannerLayout source={source} status={status} notice={notice} error={error} busy={busy}
      dialogOpen={dialogOpen} onCloseDialog={() => setDialogOpen(false)}
      onSave={createSaveHandler(resolved, run, setNotice, setStatus)}
      onSubmit={() => setDialogOpen(true)}
      onDialogSubmit={createSubmitHandler(resolved, setError, setStatus)}
      onRestart={createRestartHandler(resolved, run, setNotice, setStatus)}
      onPullLatest={createPullLatestHandler(resolved, run, setNotice, setStatus)} />
  );
}

export default SuggestionBanner;

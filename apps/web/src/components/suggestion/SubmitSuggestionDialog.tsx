/**
 * Dialog for submitting a suggestion as a pull request.
 *
 * The title is required, the note is optional, and the result replaces the
 * form with the sent suggestion and a link to it. Submitting is injectable so
 * the dialog never talks to GitHub directly in tests.
 */

import { useEffect, useState } from 'react';
import type { ProjectRecord } from '@opendraft/workspace';
import type { SaveOptions, SaveResult } from '../../suggest/save';
import type { RestartResult } from '../../suggest/restart';
import type { SuggestionStatus } from '../../suggest/status';
import type { SubmitResult } from '../../suggest/submit';

/** Input gathered by {@link SubmitSuggestionDialog}. */
export interface SubmitDialogInput {
  /** Required suggestion title. */
  title: string;
  /** Optional note shown in the suggestion body. */
  note: string;
}

/** Action a viewer can take on a suggestion project. */
export interface SuggestionActions {
  /** Read the current remote state of the suggestion. */
  check: () => Promise<SuggestionStatus>;
  /** Save local edits to the viewer's copy, optionally overwriting a moved branch. */
  save: (options?: SaveOptions) => Promise<SaveResult>;
  /** Submit or update the suggestion as a pull request. */
  submit: (input: SubmitDialogInput) => Promise<SubmitResult>;
  /** Start a new suggestion from the latest upstream default branch. */
  restart: () => Promise<RestartResult>;
  /** Replace the workspace files with the latest suggestion branch head. */
  pullLatest: () => Promise<RestartResult>;
}

/**
 * Read the signed-in viewer or throw a friendly sign-in error.
 *
 * @returns The current BFF session.
 */
async function requireSession() {
  const { getSession } = await import('../../github/bff-client');
  const session = await getSession();
  if (session === null) throw new Error('Sign in to save your suggestion.');
  return session;
}

/** Load the freshest stored record for a project. */
async function loadRecord(project: ProjectRecord): Promise<ProjectRecord> {
  const { projectRegistry } = await import('../../hooks/useProjects');
  return (await projectRegistry.get(project.id)) ?? project;
}

/** Read the remote suggestion state for a project. */
async function runCheck(
  project: ProjectRecord,
  load: () => Promise<ProjectRecord>,
): Promise<SuggestionStatus> {
  const [{ checkSuggestion }, { createCheckDeps }, record] = await Promise.all(
    [import('../../suggest/status'), import('../../suggest/browser-deps'), load()] as const,
  );
  if (record.source.kind !== 'github') return { state: 'local-only' };
  return checkSuggestion(record.source, await createCheckDeps());
}

/** Save local edits to the viewer's copy. */
async function runSave(
  project: ProjectRecord,
  load: () => Promise<ProjectRecord>,
  options: SaveOptions,
): Promise<SaveResult> {
  const [{ saveToCopy }, { createSaveDeps }, record, session] = await Promise.all(
    [import('../../suggest/save'), import('../../suggest/browser-deps'), load(), requireSession()] as const,
  );
  return saveToCopy(record.id, options, await createSaveDeps(session));
}

/** Submit or update the suggestion as a pull request. */
async function runSubmit(
  project: ProjectRecord,
  load: () => Promise<ProjectRecord>,
  input: SubmitDialogInput,
): Promise<SubmitResult> {
  const [{ submitSuggestion }, { createSubmitDeps }, record, session] = await Promise.all(
    [import('../../suggest/submit'), import('../../suggest/browser-deps'), load(), requireSession()] as const,
  );
  const body = { title: input.title, body: input.note };
  return submitSuggestion(record.id, body, await createSubmitDeps(session));
}

/** Start a new suggestion from the latest upstream default branch. */
async function runRestart(
  project: ProjectRecord,
  load: () => Promise<ProjectRecord>,
): Promise<RestartResult> {
  const [{ restartSuggestion }, { createRestartDeps }, record, session] = await Promise.all(
    [import('../../suggest/restart'), import('../../suggest/browser-deps'), load(), requireSession()] as const,
  );
  return restartSuggestion(record.id, await createRestartDeps(session));
}

/** Replace the workspace with the latest suggestion branch head. */
async function runPullLatest(
  project: ProjectRecord,
  load: () => Promise<ProjectRecord>,
): Promise<RestartResult> {
  const [{ pullLatest }, { createRestartDeps }, record, session] = await Promise.all(
    [import('../../suggest/restart'), import('../../suggest/browser-deps'), load(), requireSession()] as const,
  );
  return pullLatest(record.id, await createRestartDeps(session));
}

/**
 * Build the default browser-backed actions for a project.
 *
 * @param project - Active GitHub project.
 * @returns Actions wired to the BFF, git relay and project registry.
 */
export function createDefaultSuggestionActions(project: ProjectRecord): SuggestionActions {
  const load = (): Promise<ProjectRecord> => loadRecord(project);
  return {
    check: () => runCheck(project, load),
    save: (options) => runSave(project, load, options ?? {}),
    submit: (input) => runSubmit(project, load, input),
    restart: () => runRestart(project, load),
    pullLatest: () => runPullLatest(project, load),
  };
}

/** Props for {@link SubmitSuggestionDialog}. */
export interface SubmitSuggestionDialogProps {
  /** Whether the dialog is shown. */
  isOpen?: boolean;
  /** Alias of {@link SubmitSuggestionDialogProps.isOpen}. */
  open?: boolean;
  /** Close the dialog without submitting. */
  onClose: () => void;
  /** Send the suggestion with the entered title and note. */
  onSubmit: (input: SubmitDialogInput) => Promise<SubmitResult>;
}

const FIELD_CLASS =
  'mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500';

/** Render the success or failure outcome of a submit. */
function SubmitOutcome({ result }: { result: SubmitResult }) {
  if (result.kind === 'created' || result.kind === 'updated') {
    return (
      <div className="flex flex-col gap-1">
        <p role="status" className="text-sm font-medium text-gray-900">
          {`Suggestion #${result.number} sent`}
        </p>
        <a href={result.url} target="_blank" rel="noreferrer"
          className="text-sm text-blue-700 underline">
          View suggestion
        </a>
      </div>
    );
  }
  if (result.kind === 'closed') {
    return (
      <p role="alert" className="text-sm text-red-700">
        {`This suggestion was ${result.state}. Start a new suggestion instead.`}
      </p>
    );
  }
  return (
    <p role="alert" className="text-sm text-red-700">
      The original has changed since you started; your suggestion may need review.
    </p>
  );
}

/** Title, optional note and inline submit error. */
function SubmitFields({
  title, note, error, onTitleChange, onNoteChange,
}: {
  title: string;
  note: string;
  error: string | null;
  onTitleChange: (value: string) => void;
  onNoteChange: (value: string) => void;
}) {
  return (
    <>
      <label className="mb-2 block text-sm text-gray-700">
        Title
        <input type="text" aria-label="Title" required value={title} className={FIELD_CLASS}
          onChange={(event) => onTitleChange(event.target.value)} />
      </label>
      <label className="mb-3 block text-sm text-gray-700">
        Note (optional)
        <textarea aria-label="Note" value={note} rows={3} className={FIELD_CLASS}
          onChange={(event) => onNoteChange(event.target.value)} />
      </label>
      {error !== null ? (
        <p role="alert" className="mb-2 text-xs text-red-700">{error}</p>
      ) : null}
    </>
  );
}

/** Cancel/Done and submit buttons for the dialog. */
function DialogButtons({
  result, sending, canSubmit, onClose,
}: {
  result: SubmitResult | null;
  sending: boolean;
  canSubmit: boolean;
  onClose: () => void;
}) {
  return (
    <div className="mt-3 flex justify-end gap-2">
      <button type="button" onClick={onClose}
        className="rounded-md px-3 py-1 text-sm text-gray-600 hover:bg-gray-100">
        {result !== null ? 'Done' : 'Cancel'}
      </button>
      {result === null ? (
        <button type="submit" disabled={!canSubmit}
          className="rounded-md bg-black px-3 py-1 text-sm text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50">
          {sending ? 'Sending...' : 'Submit suggestion'}
        </button>
      ) : null}
    </div>
  );
}

/** Form state and submit logic for the dialog. */
function useSubmitForm(shown: boolean, onSubmit: (input: SubmitDialogInput) => Promise<SubmitResult>) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  useEffect(() => {
    if (!shown) {
      setTitle('');
      setNote('');
      setSending(false);
      setError(null);
      setResult(null);
    }
  }, [shown]);
  const canSubmit = title.trim() !== '' && !sending;
  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!canSubmit) return;
    setSending(true);
    setError(null);
    try {
      setResult(await onSubmit({ title: title.trim(), note: note.trim() }));
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown));
    } finally {
      setSending(false);
    }
  };
  return { title, setTitle, note, setNote, sending, error, result, canSubmit, handleSubmit };
}

/**
 * Modal form for submitting a suggestion to the upstream repository.
 *
 * @param props - See {@link SubmitSuggestionDialogProps}.
 * @returns The dialog, or null while it is closed.
 */
export function SubmitSuggestionDialog({
  isOpen, open, onClose, onSubmit,
}: SubmitSuggestionDialogProps) {
  const shown = isOpen ?? open ?? false;
  const form = useSubmitForm(shown, onSubmit);
  if (!shown) return null;
  return (
    <div role="dialog" aria-label="Submit suggestion"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <form onSubmit={(event) => void form.handleSubmit(event)} aria-label="Submit suggestion form"
        className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Submit suggestion</h2>
        {form.result !== null ? (
          <SubmitOutcome result={form.result} />
        ) : (
          <SubmitFields title={form.title} note={form.note} error={form.error}
            onTitleChange={form.setTitle} onNoteChange={form.setNote} />
        )}
        <DialogButtons result={form.result} sending={form.sending}
          canSubmit={form.canSubmit} onClose={onClose} />
      </form>
    </div>
  );
}

export default SubmitSuggestionDialog;

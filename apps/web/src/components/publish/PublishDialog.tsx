import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { listSuggestionBranches } from '../../github/bff-suggest';
import { preflight } from '../../publish/preflight';
import type { PreflightResult } from '../../publish/preflight';
import { PLACEHOLDER, draftBranch, type DraftNameStatus } from '../../suggest/branches';
import { checkDraftName } from '../../suggest/name-draft';
import { PublishChecks } from './PublishChecks';

/** Which form the dialog presents. */
export type PublishDialogVariant = 'send' | 'update';

/** Draft identity needed by the dialog. */
export interface PublishDialogDraft {
  /** Repository owner receiving the branch. */ owner: string;
  /** Repository name receiving the branch. */ repo: string;
  /** GitHub login of the draft author. */ login: string;
  /** Current local draft branch. */ branch: string;
  /** Whether the draft branch already exists on GitHub. */ pushed: boolean;
}

/** Values submitted by the dialog. */
export interface PublishDialogInput {
  /** Required change summary for send, empty for update. */ change: string;
  /** Reviewer note or update summary. */ note: string;
  /** Chosen draft name while the draft is unpushed. */ draftName: string;
}

/** Props for {@link PublishDialog}. */
export interface PublishDialogProps {
  /** Whether the dialog is shown; defaults to true. */ open?: boolean;
  /** Alias of {@link PublishDialogProps.open}. */ isOpen?: boolean;
  /** Send-for-review or send-update form. */ variant: PublishDialogVariant;
  /** Draft identity and push state. */ draft: PublishDialogDraft;
  /** Workspace validated on open when no injected runner is given. */ workspace?: WorkspaceAdapter;
  /** Injected preflight runner, primarily for tests. */ runPreflight?: () => Promise<PreflightResult>;
  /** Injected draft-name check, primarily for tests. */ checkName?: (name: string) => Promise<DraftNameStatus>;
  /** Called with the submitted values. */ onSubmit?: (input: PublishDialogInput) => Promise<void> | void;
  /** Called after a successful submit or from Cancel. */ onClose?: () => void;
  /** Called when a preflight finding is opened. */ onOpenFile?: (path: string) => void;
}

const FIELD_CLASS =
  'mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500';
const BUTTON_CLASS =
  'min-h-11 rounded-md px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50';
function initialName(branch: string): string {
  const segment = branch.slice(branch.lastIndexOf('/') + 1);
  return segment === PLACEHOLDER ? '' : segment;
}
function usePreflight(
  shown: boolean,
  workspace: WorkspaceAdapter | undefined,
  injected: (() => Promise<PreflightResult>) | undefined,
): { running: boolean; result: PreflightResult | null } {
  const [running, setRunning] = useState(true);
  const [result, setResult] = useState<PreflightResult | null>(null);
  const fallback = useCallback(async (): Promise<PreflightResult> => {
    if (!workspace) return { ok: true, errors: [], warnings: [] };
    return preflight(workspace);
  }, [workspace]);
  const run = injected ?? fallback;
  useEffect(() => {
    if (!shown) return;
    let active = true;
    setRunning(true);
    setResult(null);
    run()
      .then((next) => active && setResult(next))
      .catch((thrown: unknown) => {
        if (!active) return;
        const message = thrown instanceof Error ? thrown.message : String(thrown);
        setResult({
          ok: false,
          errors: [{ level: 'error', location: 'preflight', path: 'preflight', message }],
          warnings: [],
        });
      })
      .finally(() => active && setRunning(false));
    return () => {
      active = false;
    };
  }, [shown, run]);
  return { running, result };
}
function useNameCheck(
  shown: boolean,
  draft: PublishDialogDraft,
  name: string,
  injected: ((name: string) => Promise<DraftNameStatus>) | undefined,
): { status: DraftNameStatus | null; checking: boolean } {
  const [status, setStatus] = useState<DraftNameStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const fallback = useCallback(
    (value: string) =>
      checkDraftName(
        { owner: draft.owner, repo: draft.repo, login: draft.login, name: value },
        { listRefs: listSuggestionBranches },
      ),
    [draft.owner, draft.repo, draft.login],
  );
  const check = injected ?? fallback;
  const trimmed = name.trim();
  useEffect(() => {
    if (!shown || draft.pushed || trimmed === '') {
      setStatus(null);
      setChecking(false);
      return;
    }
    let active = true;
    setChecking(true);
    setStatus(null);
    check(trimmed)
      .then((next) => active && setStatus(next))
      .catch(() => active && setStatus(null))
      .finally(() => active && setChecking(false));
    return () => {
      active = false;
    };
  }, [shown, draft.pushed, trimmed, check]);
  return { status, checking };
}
function Fields({
  variant,
  change,
  note,
  onchange,
  onNote,
}: {
  variant: PublishDialogVariant;
  change: string;
  note: string;
  onchange: (value: string) => void;
  onNote: (value: string) => void;
}) {
  if (variant === 'update') {
    return (
      <label className="mb-2 block text-sm text-gray-700">
        What's new? (optional)
        <textarea aria-label="What's new? (optional)" rows={3} value={note}
          className={FIELD_CLASS} onChange={(event) => onNote(event.target.value)} />
      </label>
    );
  }
  return (
    <>
      <label className="mb-2 block text-sm text-gray-700">
        What did you change?
        <textarea aria-label="What did you change?" required rows={3} value={change}
          className={FIELD_CLASS} onChange={(event) => onchange(event.target.value)} />
      </label>
      <label className="mb-2 block text-sm text-gray-700">
        Anything reviewers should know? (optional)
        <textarea aria-label="Anything reviewers should know? (optional)" rows={2}
          value={note} className={FIELD_CLASS} onChange={(event) => onNote(event.target.value)} />
      </label>
    </>
  );
}
function NameFields({
  draft,
  name,
  status,
  onName,
}: {
  draft: PublishDialogDraft;
  name: string;
  status: DraftNameStatus | null;
  onName: (value: string) => void;
}) {
  if (draft.pushed) return null;
  const branch = draftBranch(draft.login, name.trim() || PLACEHOLDER);
  return (
    <div className="mb-2">
      <label className="block text-sm text-gray-700">
        Draft name
        <input type="text" aria-label="Draft name" value={name} className={FIELD_CLASS}
          onChange={(event) => onName(event.target.value)} />
      </label>
      <p className="mt-1 text-xs text-gray-600">Saved on GitHub as {branch}</p>
      {status?.kind === 'taken' ? (
        <p role="alert" className="mt-1 text-xs text-red-700">
          {`A draft with this name already exists. Try "${status.alternative}".`}
        </p>
      ) : null}
      {status?.kind === 'blocked' ? (
        <p role="alert" className="mt-1 text-xs text-red-700">This draft name is not available.</p>
      ) : null}
    </div>
  );
}
function Actions({
  label,
  canSubmit,
  submitting,
  error,
  onClose,
}: {
  label: string;
  canSubmit: boolean;
  submitting: boolean;
  error: string | null;
  onClose?: () => void;
}) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      {error !== null ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose}
          className={`${BUTTON_CLASS} text-gray-600 hover:bg-gray-100`}>Cancel</button>
        <button type="submit" disabled={!canSubmit}
          className={`${BUTTON_CLASS} bg-black px-4 text-white hover:bg-gray-900`}>
          {submitting ? 'Sending…' : label}
        </button>
      </div>
    </div>
  );
}
interface SubmitArgs {
  draft: PublishDialogDraft;
  canSubmit: boolean;
  input: PublishDialogInput;
  onSubmit: ((input: PublishDialogInput) => Promise<void> | void) | undefined;
  onClose: (() => void) | undefined;
}

function useSubmit({ draft, canSubmit, input, onSubmit, onClose }: SubmitArgs) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit?.({ ...input, draftName: input.draftName || draft.branch });
      onClose?.();
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown));
    } finally {
      setSubmitting(false);
    }
  };
  return { submitting, error, submit };
}
interface SubmitEnabledArgs {
  running: boolean;
  checking: boolean;
  result: PreflightResult | null;
  nameBlocked: boolean;
  variant: PublishDialogVariant;
  change: string;
}

function submitEnabled(args: SubmitEnabledArgs): boolean {
  return !args.running && !args.checking && args.result !== null && args.result.ok &&
    !args.nameBlocked && (args.variant !== 'send' || args.change.trim() !== '');
}

/** Modal form for sending a draft for review or posting an update. */
export function PublishDialog(props: PublishDialogProps) {
  const { variant, draft, onSubmit, onClose, onOpenFile } = props;
  const shown = props.isOpen ?? props.open ?? true;
  const [change, setChange] = useState('');
  const [note, setNote] = useState('');
  const [name, setName] = useState(() => initialName(draft.branch));
  const [nameTouched, setNameTouched] = useState(false);
  const { running, result } = usePreflight(shown, props.workspace, props.runPreflight);
  const { status, checking } = useNameCheck(shown, draft, name, props.checkName);
  const label = variant === 'send' ? 'Send for review' : 'Send update';
  const nameBlocked = !draft.pushed && (status?.kind === 'taken' || status?.kind === 'blocked');
  const canSubmit = submitEnabled({ running, checking, result, nameBlocked, variant, change });
  const input = { change: change.trim(), note: note.trim(), draftName: name.trim() };
  const { submitting, error, submit } = useSubmit({ draft, canSubmit, input, onSubmit, onClose });
  if (!shown) return null;
  const handleChange = (value: string): void => {
    setChange(value);
    if (!nameTouched && !draft.pushed) setName(value);
  };
  return (
    <div role="dialog" aria-label={label}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <form onSubmit={submit}
        className="max-h-[90dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:max-w-lg sm:rounded-2xl">
        <h2 className="mb-3 text-base font-semibold text-gray-900">{label}</h2>
        <Fields variant={variant} change={change} note={note}
          onchange={handleChange} onNote={setNote} />
        <NameFields draft={draft} name={name} status={status}
          onName={(value) => { setNameTouched(true); setName(value); }} />
        <PublishChecks running={running} result={result}
          onOpenFile={onOpenFile ?? (() => undefined)} />
        <Actions label={label} canSubmit={canSubmit} submitting={submitting}
          error={error} onClose={onClose} />
      </form>
    </div>
  );
}

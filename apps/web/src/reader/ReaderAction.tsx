/**
 * Main action button in the reader header.
 *
 * The button names the next step for the current repository: convert a plain
 * repository, edit an OpenDraft repository the viewer can push to, or suggest
 * edits elsewhere. While access is checked or a copy is prepared it shows a
 * spinner; sign-in, install, blocked and error states render the shared
 * {@link EditPopover} under the button.
 */

import { LoaderCircle } from 'lucide-react';
import type { RepoPermissions } from '../github/bff-client';
import type { EditIntent } from '../suggest/edit-intent';
import { EditPopover } from './EditPopover';
import type { ReaderRoute } from './route';
import type { SuggestEditStatus } from './use-suggest-edit';

/** Kind of repository the reader is displaying. */
export type ReaderActionKind = 'opendraft' | 'non-compliant';

/** Props for {@link ReaderAction}. */
export interface ReaderActionProps {
  /** Whether the repository is an OpenDraft project or a plain repository. */
  kind: ReaderActionKind;
  /** Viewer permissions and installation state, or null when unknown. */
  access: RepoPermissions | null;
  /** Controller status from `useSuggestEdit`. */
  status: SuggestEditStatus;
  /** Controller intent from `useSuggestEdit`. */
  intent: EditIntent | null;
  /** Controller error from `useSuggestEdit`. */
  error: string | null;
  /** Repository owner, name and optional ref from the reader URL. */
  route: ReaderRoute;
  /** Manuscript to keep selected in the intent path. */
  manuscriptId?: string;
  /** Invoked for the edit/suggest action. */
  onTrigger: () => void;
  /** Invoked for the convert action. */
  onConvert: () => void;
  /** Retry a failed preparation; defaults to {@link ReaderActionProps.onTrigger}. */
  onRetry?: () => void;
  /** Close the popover; defaults to a no-op because the controller owns state. */
  onClose?: () => void;
}

/** Props shared by the popover renderers. */
interface ActionPopoverProps {
  purpose: 'edit' | 'convert';
  intent: EditIntent | null;
  error: string | null;
  route: ReaderRoute;
  manuscriptId?: string;
  onRetry: () => void;
  onClose: () => void;
}

const BUTTON =
  'inline-flex items-center gap-2 rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60';
const WRAPPER = 'relative inline-flex';

/**
 * Derive the button label from the repository kind and viewer access.
 *
 * @param kind - OpenDraft project or plain repository.
 * @param access - Viewer permissions, or null when unknown.
 * @returns `Convert to OpenDraft`, `Edit` or `Suggest edits`.
 */
export function readerActionLabel(
  kind: ReaderActionKind,
  access: RepoPermissions | null,
): string {
  if (kind === 'non-compliant') return 'Convert to OpenDraft';
  if (access?.push === true && access.installed === true) return 'Edit';
  return 'Suggest edits';
}

/** Derived presentation state for the main action button. */
interface ActionState {
  busy: boolean;
  label: string;
  purpose: 'edit' | 'convert';
  show: boolean;
}

/** Inputs used to derive {@link ActionState}. */
interface ActionStateInput {
  kind: ReaderActionKind;
  access: RepoPermissions | null;
  status: SuggestEditStatus;
  intent: EditIntent | null;
  error: string | null;
}

/**
 * Derive button state from the repository kind, access and controller status.
 *
 * @param input - Repository kind, access, status, intent and error.
 * @returns Busy flag, label, popover purpose and whether a popover shows.
 */
function actionState(input: ActionStateInput): ActionState {
  const { kind, access, status, intent, error } = input;
  const busy = status === 'checking' || status === 'starting';
  const label =
    status === 'starting'
      ? 'Preparing your copy…'
      : readerActionLabel(kind, access);
  return {
    busy,
    label,
    purpose: kind === 'non-compliant' ? 'convert' : 'edit',
    show: intent !== null || error !== null,
  };
}

/** Render the spinner shown while access is checked or a copy is prepared. */
function Spinner() {
  return (
    <LoaderCircle
      className="h-4 w-4 animate-spin"
      aria-hidden="true"
      data-testid="reader-action-spinner"
    />
  );
}

/** Render the popover for a non-error intent, if it has a known variant. */
function IntentPopover({
  purpose,
  intent,
  route,
  manuscriptId,
  onClose,
}: ActionPopoverProps) {
  if (intent === null) return null;
  const common = { purpose, route, manuscriptId, onClose };

  if (intent.kind === 'sign-in') {
    return <EditPopover variant="sign-in" {...common} />;
  }
  if (intent.kind === 'install') {
    return <EditPopover variant="install" scope={intent.scope} {...common} />;
  }
  if (intent.kind === 'blocked') {
    return <EditPopover variant="blocked" reason={intent.reason} {...common} />;
  }
  return null;
}

/** Render the popover for the current error or intent. */
function ActionPopover(props: ActionPopoverProps) {
  const { error, purpose, route, manuscriptId, onRetry, onClose } = props;
  if (error !== null) {
    return (
      <EditPopover
        variant="error"
        purpose={purpose}
        route={route}
        manuscriptId={manuscriptId}
        message={error}
        onRetry={onRetry}
        onClose={onClose}
      />
    );
  }
  return <IntentPopover {...props} />;
}

/**
 * Run the click action unless the button is busy.
 *
 * @param kind - OpenDraft project or plain repository.
 * @param busy - Whether access is being checked or a copy prepared.
 * @param onTrigger - Edit/suggest handler.
 * @param onConvert - Convert handler.
 */
function runAction(
  kind: ReaderActionKind,
  busy: boolean,
  onTrigger: () => void,
  onConvert: () => void,
): void {
  if (busy) return;
  if (kind === 'non-compliant') onConvert();
  else onTrigger();
}

/**
 * Render the reader's main action button and its explanation popover.
 *
 * @param props - See {@link ReaderActionProps}.
 * @returns The button, the busy spinner and an optional popover below it.
 */
export function ReaderAction({
  kind,
  access,
  status,
  intent,
  error,
  route,
  manuscriptId,
  onTrigger,
  onConvert,
  onRetry,
  onClose,
}: ReaderActionProps) {
  const { busy, label, purpose, show } = actionState({
    kind,
    access,
    status,
    intent,
    error,
  });

  const handleClick = (): void =>
    runAction(kind, busy, onTrigger, onConvert);

  return (
    <div className={WRAPPER}>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-busy={busy}
        className={BUTTON}
      >
        {busy ? <Spinner /> : null}
        <span>{label}</span>
      </button>
      {show ? (
        <ActionPopover
          purpose={purpose}
          intent={intent}
          error={error}
          route={route}
          manuscriptId={manuscriptId}
          onRetry={onRetry ?? onTrigger}
          onClose={onClose ?? (() => undefined)}
        />
      ) : null}
    </div>
  );
}

export default ReaderAction;

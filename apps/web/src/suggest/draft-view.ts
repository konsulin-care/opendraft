/**
 * Derive the draft header presentation from a project source and remote state.
 *
 * The result names the main action, the entries of the split-button menu and
 * the status chip. Pending saves are added to the chip so the header explains
 * why the action may upload more than the current file.
 */

import type { ProjectSource } from '@opendraft/workspace';
import type { SuggestionState } from './status';

/** Input of {@link draftView}. */
export interface DraftViewInput {
  /** Project source: local, or GitHub with its branch state. */
  source: ProjectSource;
  /** Remote state reported by the suggestion status check. */
  state: SuggestionState;
  /** Number of saved changes that are not uploaded yet. */
  pendingSaves: number;
}

/** Kind of the main draft action, used to pick its icon. */
export type DraftActionKind = 'submit' | 'update' | 'new' | 'publish';

/** Presentation of the draft header split button and status chip. */
export interface DraftView {
  /** Label of the main action button. */
  primary: string;
  /** Entries of the split-button menu. */
  menu: string[];
  /** Status chip shown next to the draft name. */
  chip: string;
  /** Kind of the main action, used to pick its icon. */
  kind: DraftActionKind;
}

/** Action and menu derived from one suggestion state. */
interface DraftActions {
  /** Label of the main action button. */
  primary: string;
  /** Entries of the split-button menu. */
  menu: string[];
  /** Kind of the main action. */
  kind: DraftActionKind;
}

const SUBMIT: DraftActions = {
  primary: 'Submit',
  menu: ['Save to GitHub', 'Rename draft'],
  kind: 'submit',
};

const SEND_UPDATE: DraftActions = {
  primary: 'Send update',
  menu: ['Save to GitHub', 'View on GitHub'],
  kind: 'update',
};

const START_NEW: DraftActions = {
  primary: 'Start a new draft',
  menu: ['View on GitHub'],
  kind: 'new',
};

/**
 * Derive the main action and menu for a remote state.
 *
 * @param state - Remote state of the draft.
 * @returns The primary label and the menu entries.
 */
function actionsFor(state: SuggestionState): DraftActions {
  if (state === 'local-only' || state === 'draft') return SUBMIT;
  if (state === 'open' || state === 'revision-needed' || state === 'remote-moved') {
    return SEND_UPDATE;
  }
  return START_NEW;
}

/**
 * Derive the status chip for a remote state.
 *
 * @param state - Remote state of the draft.
 * @returns The plain-language chip label.
 */
function chipFor(state: SuggestionState): string {
  if (state === 'open') return 'Sent for review';
  if (state === 'revision-needed') return 'Revision needed';
  if (state === 'merged' || state === 'branch-deleted') return 'Accepted';
  if (state === 'closed') return 'Closed';
  if (state === 'remote-moved') return '⚠ Out of date';
  return 'Draft';
}

/**
 * Append the pending-save count to a status chip.
 *
 * @param chip - Base status chip label.
 * @param pendingSaves - Number of saved changes not uploaded yet.
 * @returns The chip, with a save count when one or more saves are pending.
 */
function withPendingSaves(chip: string, pendingSaves: number): string {
  if (pendingSaves <= 0) return chip;
  const noun = pendingSaves === 1 ? 'save' : 'saves';
  return `${chip} · ${pendingSaves} ${noun} waiting to upload`;
}

/**
 * Build the header view of a local or GitHub-backed draft.
 *
 * Local projects publish to GitHub and have no menu. GitHub projects send an
 * unsent draft for review, send updates while it is open, and start a new
 * draft once it is accepted or closed. The chip always describes the remote
 * state and adds pending saves when the workspace has unsent changes.
 *
 * @param input - Project source, remote state and pending-save count.
 * @returns The primary action, menu entries and status chip.
 */
export function draftView({ source, state, pendingSaves }: DraftViewInput): DraftView {
  const chip = withPendingSaves(chipFor(state), pendingSaves);
  if (source.kind === 'local') {
    return { primary: 'Publish to GitHub', menu: [], chip, kind: 'publish' };
  }

  const { primary, menu, kind } = actionsFor(state);
  return { primary, menu: [...menu], chip, kind };
}

export default draftView;

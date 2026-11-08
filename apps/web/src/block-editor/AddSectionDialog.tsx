/**
 * Modal add-section dialog following the project-drawer overlay pattern.
 * The picker view offers the core role chips, the 'More options'
 * disclosure and the custom entry point; the custom view collects a
 * required title with the derived short name collapsed behind 'Change'.
 * Back returns to the picker, Cancel closes, Add submits, Enter submits
 * and Escape closes without creating. Chip picks create and close.
 */
import { useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { SectionPicker } from './SectionPicker';
import type { SectionDraft } from './SectionPicker';
import { normalizeShortName } from './slug';

/** Props for {@link AddSectionDialog}. */
export interface AddSectionDialogProps {
  /** Create the section from a chip draft or the custom form. */
  onCreate: (draft: SectionDraft) => void;
  /** Close the dialog without creating a section. */
  onClose: () => void;
}

/** Shared text-input styling, matching the project-drawer dialogs. */
const FIELD_CLASS =
  'mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500';

/** Shared styling for the Back, Cancel and Add buttons. */
const BUTTON_CLASS = 'rounded-md px-3 py-1 text-sm';

/** Secondary button styling for Back and Cancel. */
const SECONDARY_CLASS = `${BUTTON_CLASS} text-gray-600 hover:bg-gray-100`;

/** Primary button styling for Add. */
const PRIMARY_CLASS = `${BUTTON_CLASS} bg-black text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50`;

/** Heading styling shared by both dialog views. */
const HEADING_CLASS = 'mb-3 text-sm font-semibold text-gray-900';

/** Panel styling shared by both dialog views. */
const PANEL_CLASS = 'w-full max-w-sm rounded-lg bg-white p-4 shadow-xl';

/** Handlers the picker view wires to the chips and the footer. */
interface PickViewProps {
  /** Receives the chip draft before the dialog closes. */
  onCreate: (draft: SectionDraft) => void;
  /** Close the dialog. */
  onClose: () => void;
  /** Switch to the custom view. */
  onCustom: () => void;
}

/** Title input wiring: current text and its change handler. */
interface TitleFieldProps {
  /** Current title text. */
  value: string;
  /** Receive the new title text. */
  onChange: (value: string) => void;
}

/** Short-name row wiring: value, reveal state and handlers. */
interface ShortNameFieldProps {
  /** Effective short name shown or edited. */
  value: string;
  /** Whether the editable input is revealed. */
  revealed: boolean;
  /** Receive the raw input value; an empty string releases the lock. */
  onChange: (value: string) => void;
  /** Reveal the editable input. */
  onReveal: () => void;
}

/** Footer wiring: validity flag and the three button handlers. */
interface DialogFooterProps {
  /** Whether the title is non-empty. */
  canAdd: boolean;
  /** Return to the picker view. */
  onBack: () => void;
  /** Close the dialog without creating. */
  onCancel: () => void;
  /** Submit the custom form. */
  onAdd: () => void;
}

/** Custom view wiring: create/close handlers and the Back callback. */
interface CustomViewProps {
  /** Receives the custom draft on a valid submit. */
  onCreate: (draft: SectionDraft) => void;
  /** Close the dialog. */
  onClose: () => void;
  /** Return to the picker view. */
  onBack: () => void;
}

/**
 * Picker view: the section chips create and close, the custom entry
 * point switches the dialog to the custom view, and Cancel closes.
 *
 * @param props - See {@link PickViewProps}.
 * @returns The picker panel element.
 */
function PickView({ onCreate, onClose, onCustom }: PickViewProps) {
  return (
    <div className={PANEL_CLASS}>
      <h2 className={HEADING_CLASS}>Add section</h2>
      <SectionPicker
        onCreate={(draft) => { onCreate(draft); onClose(); }}
        onCustom={onCustom}
      />
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={SECONDARY_CLASS}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * Collect the custom section draft: a required title, the derived short
 * name with a manual lock, and submit gating.
 *
 * @param onCreate - Receives the draft on a valid submit.
 * @param onClose - Closes the dialog after a submit.
 * @returns Title and short state, handlers, and the derived short name.
 */
function useCustomSection(
  onCreate: (draft: SectionDraft) => void,
  onClose: () => void,
) {
  const [title, setTitle] = useState('');
  const [short, setShort] = useState('');
  const [shortEdited, setShortEdited] = useState(false);

  const trimmedTitle = title.trim();
  const effectiveShort = shortEdited ? short : normalizeShortName(title);
  const canAdd = trimmedTitle !== '';

  /** Keep the manual short-name lock; clearing it resumes derivation. */
  const onShortChange = (value: string) => {
    if (value === '') {
      setShort('');
      setShortEdited(false);
      return;
    }
    setShort(value);
    setShortEdited(true);
  };

  /** Submit the custom form; an empty title is refused. */
  const submit = (event?: FormEvent | KeyboardEvent) => {
    event?.preventDefault();
    if (!canAdd) return;
    onCreate({ title: trimmedTitle, short: effectiveShort });
    onClose();
  };

  return { title, setTitle, effectiveShort, canAdd, onShortChange, submit };
}

/**
 * Required title input; autofocused when the custom view opens.
 *
 * @param props - See {@link TitleFieldProps}.
 * @returns The labelled title input.
 */
function TitleField({ value, onChange }: TitleFieldProps) {
  return (
    <label className="mb-3 block text-sm text-gray-700">
      Title
      <input
        type="text" aria-label="Title" required autoFocus value={value}
        onChange={(event) => onChange(event.target.value)} className={FIELD_CLASS}
      />
    </label>
  );
}

/**
 * Derived short name: collapsed read-only text behind a 'Change'
 * button until revealed as an editable input.
 *
 * @param props - See {@link ShortNameFieldProps}.
 * @returns The short-name row.
 */
function ShortNameField({
  value,
  revealed,
  onChange,
  onReveal,
}: ShortNameFieldProps) {
  return (
    <div className="mb-3 text-sm text-gray-700">
      <div className="flex items-center justify-between">
        <span>Short name</span>
        {!revealed && (
          <button
            type="button" onClick={onReveal}
            className="text-xs text-gray-600 underline hover:text-gray-900"
          >
            Change
          </button>
        )}
      </div>
      {revealed ? (
        <input
          type="text" aria-label="Short name" value={value}
          onChange={(event) => onChange(event.target.value)} className={FIELD_CLASS}
        />
      ) : (
        <code aria-label="Short name value" className="font-mono text-xs">{value}</code>
      )}
    </div>
  );
}

/**
 * Custom view footer: Back to the picker, Cancel to close, Add to
 * submit; Add stays disabled while the title is empty.
 *
 * @param props - See {@link DialogFooterProps}.
 * @returns The footer button row.
 */
function DialogFooter({ canAdd, onBack, onCancel, onAdd }: DialogFooterProps) {
  return (
    <div className="flex justify-end gap-2">
      <button type="button" onClick={onBack} className={SECONDARY_CLASS}>Back</button>
      <button type="button" onClick={onCancel} className={SECONDARY_CLASS}>Cancel</button>
      <button type="button" onClick={onAdd} disabled={!canAdd} className={PRIMARY_CLASS}>
        Add
      </button>
    </div>
  );
}

/**
 * Custom section view: required title, derived short name collapsed
 * behind 'Change', and the Back/Cancel/Add footer. Enter submits and
 * an empty title is refused.
 *
 * @param props - See {@link CustomViewProps}.
 * @returns The custom section form element.
 */
function CustomView({ onCreate, onClose, onBack }: CustomViewProps) {
  const [shortRevealed, setShortRevealed] = useState(false);
  const { title, setTitle, effectiveShort, canAdd, onShortChange, submit } =
    useCustomSection(onCreate, onClose);

  /** Enter in the form submits it. */
  const onKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    submit(event);
  };

  return (
    <form aria-label="Custom section form" onSubmit={submit} onKeyDown={onKeyDown} className={PANEL_CLASS}>
      <h2 className={HEADING_CLASS}>Custom section</h2>
      <TitleField value={title} onChange={setTitle} />
      <ShortNameField
        value={effectiveShort} revealed={shortRevealed} onChange={onShortChange}
        onReveal={() => setShortRevealed(true)}
      />
      <DialogFooter canAdd={canAdd} onBack={onBack} onCancel={onClose} onAdd={() => submit()} />
    </form>
  );
}

/**
 * Modal add-section dialog. Toggles between the picker and custom
 * views, closes on Escape from either view, and follows the
 * project-drawer overlay pattern.
 *
 * @param props - See {@link AddSectionDialogProps}.
 */
export function AddSectionDialog({ onCreate, onClose }: AddSectionDialogProps) {
  const [view, setView] = useState<'pick' | 'custom'>('pick');

  /** Escape closes the dialog from either view. */
  const onDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    onClose();
  };

  return (
    <div role="dialog" aria-label="Add section" onKeyDown={onDialogKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      {view === 'pick' ? (
        <PickView onCreate={onCreate} onClose={onClose} onCustom={() => setView('custom')} />
      ) : (
        <CustomView onCreate={onCreate} onClose={onClose} onBack={() => setView('pick')} />
      )}
    </div>
  );
}

import { useState } from 'react';
import { isValidManuscriptId, toManuscriptId } from '../../project/slugify';

/** Props for {@link NewProjectDialog}. */
export interface NewProjectDialogProps {
  /** Register and scaffold the new project; called with the trimmed name and id. */
  onCreate: (name: string, manuscriptId: string) => void;
  /** Close the dialog without creating a project. */
  onClose: () => void;
}

/** Shared text-input styling for the dialog fields. */
const FIELD_CLASS =
  'mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500';

/**
 * Project name field; drives the derived manuscript id until it is edited.
 *
 * @param props - Current value and change handler.
 */
function NameField({
  value,
  onChange,
}: {
  /** Current name text. */
  value: string;
  /** Receive the new name text. */
  onChange: (value: string) => void;
}) {
  return (
    <label className="mb-2 block text-sm text-gray-700">
      Project name
      <input
        type="text"
        aria-label="Project name"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD_CLASS}
      />
    </label>
  );
}

/**
 * Manuscript id field, validated against the id pattern.
 *
 * @param props - Current value and change handler marking the id as edited.
 */
function IdField({
  value,
  onChange,
}: {
  /** Current id text. */
  value: string;
  /** Receive the new id text. */
  onChange: (value: string) => void;
}) {
  return (
    <label className="mb-3 block text-sm text-gray-700">
      Manuscript id
      <input
        type="text"
        aria-label="Manuscript id"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${FIELD_CLASS} font-mono`}
      />
    </label>
  );
}

/**
 * Validation notice shown while the manuscript id fails the id pattern.
 *
 * @param props - None; rendered from the dialog's id state.
 */
function IdAlert() {
  return (
    <p role="alert" className="mb-3 text-xs text-red-600">
      Use lowercase letters, digits and single hyphens only.
    </p>
  );
}

/**
 * Dialog footer: cancel and create buttons; create is disabled while the
 * form is invalid.
 *
 * @param props - Whether creating is allowed, and the cancel handler.
 */
function DialogFooter({
  canCreate,
  onClose,
}: {
  /** Whether the form is valid enough to create the project. */
  canCreate: boolean;
  /** Close the dialog without creating a project. */
  onClose: () => void;
}) {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        className="rounded-md px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={!canCreate}
        className="rounded-md bg-black px-3 py-1 text-sm text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Create
      </button>
    </div>
  );
}

/**
 * Modal dialog for registering a new project. The name field drives the
 * manuscript id field, which is pre-filled via {@link toManuscriptId} until
 * the user edits it directly. Create is disabled while the name is empty or
 * the id fails {@link isValidManuscriptId}.
 *
 * @param props - See {@link NewProjectDialogProps}.
 */
export function NewProjectDialog({ onCreate, onClose }: NewProjectDialogProps) {
  const [name, setName] = useState('');
  const [manuscriptId, setManuscriptId] = useState('');
  const [idEdited, setIdEdited] = useState(false);

  const trimmedName = name.trim();
  const idValid = isValidManuscriptId(manuscriptId);
  const canCreate = trimmedName !== '' && idValid;

  /** Update the name; keep the derived id in sync until it is edited. */
  const onNameChange = (value: string) => {
    setName(value);
    if (!idEdited) setManuscriptId(toManuscriptId(value));
  };

  /** Update the id directly and stop deriving it from the name. */
  const onIdChange = (value: string) => {
    setManuscriptId(value);
    setIdEdited(true);
  };

  /** Submit the dialog when the form is valid. */
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canCreate) return;
    onCreate(trimmedName, manuscriptId);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-label="New project"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
    >
      <form
        onSubmit={submit}
        aria-label="New project form"
        className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl"
      >
        <h2 className="mb-3 text-sm font-semibold text-gray-900">New project</h2>
        <NameField value={name} onChange={onNameChange} />
        <IdField value={manuscriptId} onChange={onIdChange} />
        {!idValid && manuscriptId !== '' && <IdAlert />}
        <DialogFooter canCreate={canCreate} onClose={onClose} />
      </form>
    </div>
  );
}

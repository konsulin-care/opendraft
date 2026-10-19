import { useEffect, useState } from 'react';

/** Minimal project shape the dialog needs: an id to delete and the name to type. */
export interface DeletableProject {
  /** Id handed to onConfirm once the exact name is typed. */
  id: string;
  /** Exact name the user must type to unlock the confirm action. */
  name: string;
}

/** Props for {@link DeleteProjectDialog}. */
export interface DeleteProjectDialogProps {
  /** Project being deleted; its exact name unlocks the confirm action. */
  project: DeletableProject;
  /** Remove the project; called once with the project id after a match. */
  onConfirm: (id: string) => void;
  /** Cancel the deletion without removing anything. */
  onCancel: () => void;
}

/** Shared text-input styling for the confirmation field. */
const FIELD_CLASS =
  'mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-500';

/**
 * Close the dialog when Escape is pressed, from anywhere on the page.
 *
 * @param onCancel - Cancel handler invoked on Escape.
 */
function useEscapeCancel(onCancel: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);
}

/**
 * Cancel and confirm actions; confirm stays disabled until the name matches.
 *
 * @param props - Project id, whether the typed name matches, and the handlers.
 */
function DialogActions({
  id,
  matches,
  onConfirm,
  onCancel,
}: {
  /** Id passed to onConfirm when the delete button is clicked. */
  id: string;
  /** Whether the typed name matches; false disables the confirm button. */
  matches: boolean;
  /** Remove the project with the given id. */
  onConfirm: (id: string) => void;
  /** Cancel the deletion without removing anything. */
  onCancel: () => void;
}) {
  return (
    <div className="flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={() => onConfirm(id)}
        disabled={!matches}
        className="rounded-md bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Delete project
      </button>
    </div>
  );
}

/**
 * Confirmation panel: type-the-name field plus cancel and confirm actions.
 *
 * @param props - See {@link DeleteProjectDialogProps}.
 */
function ConfirmPanel({ project, onConfirm, onCancel }: DeleteProjectDialogProps) {
  const [value, setValue] = useState('');
  const matches = value === project.name;

  /** Submit on Enter, but only when the typed name matches exactly. */
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (!matches) return;
    onConfirm(project.id);
  };

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      className="relative w-full max-w-sm rounded-lg bg-white p-4 shadow-xl"
    >
      <h2 className="mb-1 text-sm font-semibold text-gray-900">Delete project</h2>
      <p className="mb-2 text-xs text-gray-600">
        Type “{project.name}” to confirm deletion.
      </p>
      <label className="mb-3 block text-sm text-gray-700">
        Project name
        <input
          type="text"
          aria-label="Confirm project name"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={onKeyDown}
          className={FIELD_CLASS}
        />
      </label>
      <DialogActions
        id={project.id}
        matches={matches}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    </div>
  );
}

/**
 * Modal dialog for deleting a project with type-the-name confirmation.
 * The confirm action stays disabled until the input equals the project
 * name exactly, and Enter submits only on a match. Escape and a backdrop
 * click cancel without deleting.
 *
 * @param props - See {@link DeleteProjectDialogProps}.
 */
export function DeleteProjectDialog({
  project,
  onConfirm,
  onCancel,
}: DeleteProjectDialogProps) {
  useEscapeCancel(onCancel);

  return (
    <div
      role="dialog"
      aria-label="Delete project"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
    >
      <div
        data-testid="delete-project-dialog-backdrop"
        aria-hidden="true"
        onClick={onCancel}
        className="fixed inset-0"
      />
      <ConfirmPanel project={project} onConfirm={onConfirm} onCancel={onCancel} />
    </div>
  );
}

import { useState } from 'react';

/** Which side of a conflict wins for a single file. */
export type ConflictChoice = 'mine' | 'theirs';

/** Props for {@link ConflictDialog}. */
export interface ConflictDialogProps {
  /** Paths that changed both locally and on GitHub. */
  paths: string[];
  /** Called with one choice per path when the user continues. */
  onResolve: (choices: Record<string, ConflictChoice>) => void;
  /** Optional cancel handler; when provided, Escape and Cancel close the dialog. */
  onCancel?: () => void;
}

/**
 * Build the default resolution map: every file keeps the accepted version.
 *
 * @param paths - Conflicting paths.
 * @returns A map of path to the default `theirs` choice.
 */
function acceptedByDefault(paths: string[]): Record<string, ConflictChoice> {
  return Object.fromEntries(paths.map((path) => [path, 'theirs' as const]));
}

/**
 * One conflict row: the file path plus the two per-file choices.
 *
 * @param props - Path, selected choice, and the change handler for the row.
 */
function ConflictRow({
  path,
  choice,
  onChange,
}: {
  /** Path of the conflicting file. */
  path: string;
  /** Currently selected resolution for this path. */
  choice: ConflictChoice;
  /** Update the resolution for this path. */
  onChange: (choice: ConflictChoice) => void;
}) {
  return (
    <fieldset className="border-t border-gray-200 py-2 first:border-t-0">
      <legend className="w-full break-all py-1 text-sm font-medium text-gray-900">
        {path}
      </legend>
      <label className="flex min-h-11 items-center gap-2 text-sm text-gray-700">
        <input
          type="radio"
          name={`conflict-${path}`}
          value="mine"
          checked={choice === 'mine'}
          onChange={() => onChange('mine')}
        />
        Keep my version
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm text-gray-700">
        <input
          type="radio"
          name={`conflict-${path}`}
          value="theirs"
          checked={choice === 'theirs'}
          onChange={() => onChange('theirs')}
        />
        Keep the accepted version
      </label>
    </fieldset>
  );
}

/**
 * Modal dialog for resolving per-file conflicts after a rebase. The
 * heading names how many files changed on GitHub while the user was
 * editing, each row defaults to the accepted version, and Continue
 * reports one choice per path.
 *
 * @param props - See {@link ConflictDialogProps}.
 */
export function ConflictDialog({ paths, onResolve, onCancel }: ConflictDialogProps) {
  const [choices, setChoices] = useState<Record<string, ConflictChoice>>(() =>
    acceptedByDefault(paths),
  );
  const count = paths.length;

  return (
    <div
      role="dialog"
      aria-label="Resolve conflicts"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
    >
      <div className="relative flex max-h-[90dvh] w-full flex-col overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:max-w-lg sm:rounded-2xl">
        <h2 className="mb-3 text-base font-semibold text-gray-900">
          {count} files changed on GitHub while you were editing
        </h2>
        {paths.map((path) => (
          <ConflictRow
            key={path}
            path={path}
            choice={choices[path] ?? 'theirs'}
            onChange={(choice) =>
              setChoices((current) => ({ ...current, [path]: choice }))
            }
          />
        ))}
        <div className="mt-4 flex justify-end gap-2">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="min-h-11 rounded-md px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
            >
              Cancel
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onResolve(choices)}
            className="min-h-11 rounded-md bg-gray-900 px-4 py-1 text-sm text-white hover:bg-gray-800"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

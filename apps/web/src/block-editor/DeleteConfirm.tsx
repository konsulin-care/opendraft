/**
 * Delete confirmation dialog: names the section and lists every
 * `@sec-` reference that would break when the block is deleted.
 * Confirm deletes, cancel closes.
 */

/** Delete confirmation state: the section and the refs that would dangle. */
export interface DeleteTarget {
  /** Short name of the block being deleted. */
  short: string;
  /** Section title shown in the dialog heading. */
  title: string;
  /** One entry per breaking reference, e.g. `'@sec-methods in intro'`. */
  refs: string[];
}

/** Props for {@link DeleteConfirm}. */
export interface DeleteConfirmProps {
  /** Target naming the section and breaking refs; null renders nothing. */
  target: DeleteTarget | null;
  /** Delete the section; invoked by the confirm button. */
  onConfirm: () => Promise<void>;
  /** Close the dialog without deleting. */
  onCancel: () => void;
}

/**
 * Single delete confirmation: names the section and lists every
 * `@sec-` reference that would break. Confirm deletes, cancel closes.
 *
 * @param props - See {@link DeleteConfirmProps}.
 * @returns The dialog markup.
 */
export function DeleteConfirm({ target, onConfirm, onCancel }: DeleteConfirmProps) {
  if (target === null) return null;
  const { title, refs } = target;
  return (
    <div
      role="dialog"
      aria-label={`Delete ${title}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
    >
      <div className="w-full max-w-sm rounded-lg bg-white p-4 shadow-xl">
        <h2 className="mb-2 text-base font-semibold text-gray-900">Delete {title}</h2>
        {refs.length === 0 ? (
          <p className="mb-3 text-sm text-gray-600">
            No @sec- references point at this section.
          </p>
        ) : (
          <>
            <p className="mb-1 text-sm text-gray-600">
              Deleting breaks these references:
            </p>
            <ul className="mb-3 list-inside list-disc text-sm text-gray-700">
              {refs.map((ref, index) => (
                <li key={`${ref}:${index}`}>{ref}</li>
              ))}
            </ul>
          </>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-11 rounded-md px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            className="min-h-11 rounded-md bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
          >
            Delete block
          </button>
        </div>
      </div>
    </div>
  );
}

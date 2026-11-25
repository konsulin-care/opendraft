import { useEffect, useId, useRef } from 'react';
import type { ReactNode, MouseEvent, SyntheticEvent } from 'react';
import { X } from 'lucide-react';
import { PRIMARY_BUTTON } from './button-styles';

/** Footer action rendered as a full-width primary button. */
export interface BottomSheetAction {
  /** Button label. */
  label: string;
  /** Called when the footer button is pressed. */
  onClick: () => void;
}

/** Props for {@link BottomSheet}. */
export interface BottomSheetProps {
  /** Heading text shown at the top of the sheet and used as its accessible name. */
  title: string;
  /** Sheet body content. */
  children: ReactNode;
  /** Optional footer action button. */
  action?: BottomSheetAction;
  /** Called when the sheet is dismissed via Escape, backdrop or the close button. */
  onClose: () => void;
}

/**
 * Open the native dialog modally when the browser supports it, falling
 * back to the `open` attribute in environments without `showModal`
 * (such as jsdom 25).
 *
 * @param dialog - The dialog element, or null before mount.
 */
function openDialog(dialog: HTMLDialogElement | null): void {
  if (!dialog) return;
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    dialog.setAttribute('open', '');
  }
}

/**
 * Close the native dialog when possible so focus returns to the
 * opener, ignoring environments without `close`.
 *
 * @param dialog - The dialog element, or null.
 */
function closeDialog(dialog: HTMLDialogElement | null): void {
  if (!dialog) return;
  if (typeof dialog.close === 'function') {
    dialog.close();
  } else {
    dialog.removeAttribute('open');
  }
}

/**
 * Header row with the accessible heading and the close button.
 *
 * @param props - Heading id, title and close callback.
 * @returns The header markup.
 */
function SheetHeader({ headingId, title, onClose }: { headingId: string; title: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3">
      <h2 id={headingId} className="text-base font-semibold">
        {title}
      </h2>
      <button
        type="button"
        data-testid="bottom-sheet-close"
        aria-label="Close"
        onClick={onClose}
        className="shrink-0 rounded p-1 text-gray-500 hover:text-gray-900"
      >
        <X className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Optional full-width footer action button.
 *
 * @param props - The action descriptor.
 * @returns The footer markup, or null without an action.
 */
function SheetAction({ action }: { action?: BottomSheetAction }) {
  if (!action) return null;
  return (
    <div className="border-t border-gray-200 p-3">
      <button
        type="button"
        data-testid="bottom-sheet-action"
        onClick={action.onClick}
        className={`min-h-11 w-full ${PRIMARY_BUTTON}`}
      >
        {action.label}
      </button>
    </div>
  );
}

/**
 * Bottom-anchored modal sheet for touch interactions. Renders a native
 * `<dialog>` with a scrollable body and an optional full-width action.
 *
 * @param props - Title, body, optional action and close callback.
 * @returns The sheet markup.
 */
export function BottomSheet({ title, children, action, onClose }: BottomSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    openDialog(dialog);
    return () => closeDialog(dialog);
  }, []);

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault();
    onClose();
  };

  const handleBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  const handleCloseButton = () => {
    closeDialog(dialogRef.current);
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      data-testid="bottom-sheet"
      aria-labelledby={headingId}
      onCancel={handleCancel}
      onClick={handleBackdrop}
      className="m-0 mt-auto max-h-[70vh] w-full rounded-t-2xl bg-white p-0 text-gray-900 backdrop:bg-black/40"
    >
      <div className="flex max-h-[70vh] flex-col">
        <SheetHeader headingId={headingId} title={title} onClose={handleCloseButton} />
        <div className="overflow-y-auto px-4 py-3">{children}</div>
        <SheetAction action={action} />
      </div>
    </dialog>
  );
}

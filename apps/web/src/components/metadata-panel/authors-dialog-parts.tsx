/**
 * Header, shell and footer parts of the Authors dialog: the
 * `Author order:` position header whose select reorders the open
 * author, the dialog frame (a full-screen sheet below 640px) whose
 * body scrolls between header and footer, and the fixed footer with
 * the Undo toast, Delete author/Discard, Add author, Done and the
 * save indicator. The title has no close button — Escape and
 * backdrop click still close the dialog.
 */
import { type ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { SaveStatus } from '../AppHeader';

/**
 * Form header: the `Author order:` label, the position select whose
 * tooltip explains it reorders the author and the `of M` count.
 * Bottom padding separates the header from the Person/Group toggle
 * of the card below; deletion lives in the footer.
 *
 * @param props - Open author index, total author count and the
 * reorder callback.
 * @returns The header row rendering the position select.
 */
export function AuthorOrderHeader({ index, total, onMove }: {
  index: number; total: number; onMove(to: number): void;
}): ReactNode {
  return (
    <div data-testid="author-position-header" className="flex items-center gap-2 px-2 pt-1 pb-3">
      <h3 className="text-sm font-medium">Author order:</h3>
      <select
        data-testid="author-position"
        aria-label="Author order"
        title="Changes this author's position in the author list"
        value={index + 1}
        onChange={(event) => onMove(Number(event.target.value) - 1)}
        className="min-h-11 rounded border border-secondary px-2 text-sm"
      >
        {Array.from({ length: total }, (_, i) => (
          <option key={i + 1} value={i + 1}>{i + 1}</option>
        ))}
      </select>
      <span className="text-sm">of {total}</span>
    </div>
  );
}

/**
 * Dialog frame: a full-screen sheet below 640px, a centered card
 * otherwise. On narrow viewports the title, the scrolling body and
 * the footer share one centered `.reading-column` (80% of the pane,
 * see index.css) and the frame keeps only vertical padding, so the
 * side gutters come from the column alone; wide stays padded. The
 * frame is a column whose middle region scrolls, so the title and
 * the footer stay fixed; the title row has no close button, the
 * backdrop click closes the centered variant and Escape closes
 * from anywhere.
 *
 * @param props - Narrow viewport flag, close callback, fixed footer
 * and the scrolling body children.
 * @returns The dialog frame wrapping body and footer.
 */
export function DialogShell({ narrow, onClose, footer, children }: {
  narrow: boolean; onClose: () => void; footer?: ReactNode; children: ReactNode;
}): ReactNode {
  const column = (
    <>
      <h2 className="font-medium">Authors</h2>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer}
    </>
  );
  const frame = (
    <div role="dialog" aria-modal="true" aria-label="Authors" data-testid="authors-dialog"
      className={narrow
        ? 'fixed inset-0 z-30 flex flex-col bg-white py-3'
        : 'flex max-h-[80vh] w-full max-w-2xl flex-col rounded border border-secondary bg-white p-3 shadow'}>
      {narrow ? <div className="reading-column flex min-h-0 flex-1 flex-col">{column}</div> : column}
    </div>
  );
  if (narrow) return frame;
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black-08"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      {frame}
    </div>
  );
}

/**
 * Fixed, non-scrolling footer: the Undo toast above the action row,
 * the quiet red Delete author button (Discard on the draft) at the
 * left, Add author and Done at the right, and the panel autosave
 * indicator below. Delete renders the Trash2 icon only on all
 * viewports, with an aria-label and a matching title tooltip.
 *
 * @param props - Draft flag, open author index, delete/discard,
 * add and close callbacks, the panel save status and the Undo
 * toast node.
 * @returns The footer element.
 */
export function DialogFooter({ draft, index, onDelete, onAdd, onClose, saveStatus, toast }: {
  draft: boolean;
  index: number | null;
  onDelete(): void;
  onAdd(): void;
  onClose(): void;
  saveStatus?: SaveStatus;
  toast?: ReactNode;
}): ReactNode {
  const label = draft ? 'Discard' : 'Delete author';
  return (
    <div data-testid="authors-dialog-footer" className="mt-auto shrink-0 border-t border-secondary pt-2">
      {toast}
      <div data-testid="authors-footer-actions" className="flex items-center gap-2">
        {(draft || index !== null) && (
          <button type="button" data-testid={draft ? 'author-discard' : 'author-remove'} aria-label={label} title={label}
            onClick={onDelete} className="min-h-11 rounded px-2 text-error hover:bg-hover">
            <Trash2 aria-hidden className="inline size-4" />
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button type="button" data-testid="add-author-dialog" onClick={onAdd}
            className="min-h-11 rounded border border-secondary px-3 text-sm hover:bg-hover">
            <Plus aria-hidden className="inline size-3.5" /> Add author
          </button>
          <button type="button" data-testid="authors-done" onClick={onClose}
            className="min-h-11 rounded bg-black px-4 text-white hover:opacity-90">Done</button>
        </div>
      </div>
      <div data-testid="authors-save-status" className="pt-1 text-xs text-muted">
        {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : ''}
      </div>
    </div>
  );
}

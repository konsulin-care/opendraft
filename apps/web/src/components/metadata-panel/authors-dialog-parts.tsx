/**
 * Header and shell parts of the Authors dialog: the `Author order:`
 * position header whose select reorders the open author, and the
 * dialog frame (a full-screen sheet below 640px). The header carries
 * bottom spacing so the select does not touch the Person/Group
 * toggle, and the dialog title has no close button — Escape and
 * backdrop click still close the dialog.
 */
import { type ReactNode } from 'react';
import { X } from 'lucide-react';

/**
 * Form header: the `Author order:` label, the position select whose
 * tooltip explains it reorders the author, the `of M` count and the
 * remove button. Bottom padding separates the header from the
 * Person/Group toggle of the card below.
 *
 * @param props - Open author index, total author count, reorder and
 * remove callbacks.
 * @returns The header row rendering the position select.
 */
export function AuthorOrderHeader({ index, total, onMove, onRemove }: {
  index: number; total: number; onMove(to: number): void; onRemove(): void;
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
      <button type="button" data-testid={`author-remove-${index}`} aria-label={`Remove author ${index + 1}`}
        onClick={onRemove} className="ml-auto min-h-11 rounded px-2 hover:bg-hover">
        <X aria-hidden className="inline size-4" />
      </button>
    </div>
  );
}

/**
 * Dialog frame: a full-screen sheet below 640px, a centered card
 * otherwise. The title row has no close button; the backdrop click
 * closes the centered variant and Escape closes from anywhere.
 *
 * @param props - Narrow viewport flag, close callback and body children.
 * @returns The dialog frame wrapping the body children.
 */
export function DialogShell({ narrow, onClose, children }: {
  narrow: boolean; onClose: () => void; children: ReactNode;
}): ReactNode {
  const frame = (
    <div role="dialog" aria-modal="true" aria-label="Authors" data-testid="authors-dialog"
      className={narrow
        ? 'fixed inset-0 z-30 flex flex-col overflow-y-auto bg-white p-3'
        : 'max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded border border-secondary bg-white p-3 shadow'}>
      <h2 className="font-medium">Authors</h2>
      {children}
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

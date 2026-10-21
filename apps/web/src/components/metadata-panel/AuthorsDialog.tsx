/**
 * Authors dialog of the manuscript metadata panel.
 *
 * Vertical cards in authorship order: the selected card expands inline
 * while the others stay compact. Authors reorder via the up/down
 * buttons or drag, remove with an Undo toast, and a freshly added draft
 * author is written to _author.yml only once it has a family name
 * (person) or a literal name (group). Escape closes the dialog.
 */
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import { GripVertical, Plus, X } from 'lucide-react';
import type { MetadataAuthor } from './use-manuscript-metadata';
import { AuthorCard, type GroupOption } from './AuthorCard';

/** Props for {@link AuthorsDialog}. */
export interface AuthorsDialogProps {
  /** Author entries in authorship order. */
  authors: MetadataAuthor[];
  /** Persist the new author list to _author.yml. */
  setAuthors: (authors: MetadataAuthor[]) => void;
  /** Author index to open expanded; defaults to the first author. */
  initialIndex?: number;
  /** Start with a new draft author card expanded. */
  startWithDraft?: boolean;
  /** Close the dialog. */
  onClose: () => void;
}

/** Undo toast visibility window. */
const UNDO_MS = 8000;

/** A person draft with no name fields filled in yet. */
const EMPTY_DRAFT: MetadataAuthor = { name: { given: '', family: '' } };

/** Expanded-card selection: an author index, the draft, or nothing. */
type Selection = number | 'draft' | null;

/** Removed author held by the undo toast. */
interface RemovedAuthor {
  author: MetadataAuthor;
  index: number;
}

// Coerce an author name into a plain string record.
function nameRecord(author: MetadataAuthor): Record<string, string> {
  const name = author.name;
  if (typeof name === 'string') return { family: name };
  if (name && typeof name === 'object' && !Array.isArray(name)) {
    return Object.fromEntries(
      Object.entries(name as Record<string, unknown>)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
  }
  return {};
}

// Display name: literal for groups, given + particle + family + suffix.
function displayName(author: MetadataAuthor): string {
  const name = nameRecord(author);
  if (name.literal) return name.literal;
  return [name.given, name.particle, name.family, name.suffix].filter(Boolean).join(' ');
}

// A draft is named once it has a family name (person) or a literal.
function isNamed(author: MetadataAuthor): boolean {
  const name = nameRecord(author);
  return Boolean(name.family || name.literal);
}

// Hidden author id slugged from the display name.
function slugOf(author: MetadataAuthor): string {
  return displayName(author)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Move one entry to a new index, returning a new array.
function moved(authors: MetadataAuthor[], from: number, to: number): MetadataAuthor[] {
  const next = [...authors];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// Group options for the "On behalf of" dropdown of every card.
function groupsOf(authors: MetadataAuthor[]): GroupOption[] {
  return authors
    .filter((author) => 'literal' in nameRecord(author))
    .map((author) => ({ id: String(author.id ?? ''), name: displayName(author) }));
}

// Close the dialog when Escape is pressed, from anywhere on the page.
function useEscape(onClose: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);
}

// Removed-author state, undo timer and the reorder/remove/undo operations.
function useAuthorOps(
  authors: MetadataAuthor[],
  setAuthors: (authors: MetadataAuthor[]) => void,
  setSelected: (selection: Selection) => void,
): {
  removed: RemovedAuthor | null;
  dragFrom: { current: number | null };
  move(from: number, to: number): void;
  removeAt(index: number): void;
  undo(): void;
} {
  const [removed, setRemoved] = useState<RemovedAuthor | null>(null);
  const dragFrom = useRef<number | null>(null);
  useEffect(() => {
    if (!removed) return;
    const timer = setTimeout(() => setRemoved(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [removed]);
  const move = (from: number, to: number): void => {
    if (to < 0 || to >= authors.length) return;
    setAuthors(moved(authors, from, to));
    setSelected(to);
  };
  const removeAt = (index: number): void => {
    setRemoved({ author: authors[index], index });
    setAuthors(authors.filter((_, i) => i !== index));
    setSelected(authors.length === 1 ? null : Math.min(index, authors.length - 2));
  };
  const undo = (): void => {
    if (!removed) return;
    const restored = [...authors];
    restored.splice(removed.index, 0, removed.author);
    setAuthors(restored);
    setSelected(removed.index);
    setRemoved(null);
  };
  return { removed, dragFrom, move, removeAt, undo };
}

/** One author slot: the compact row and, when selected, the expanded card. */
function CardSlot(props: {
  author: MetadataAuthor;
  index: number;
  total: number;
  expanded: boolean;
  groups: GroupOption[];
  onExpand(): void;
  onChange(next: MetadataAuthor): void;
  onMoveUp(): void;
  onMoveDown(): void;
  onRemove(): void;
  onDragStart(): void;
  onDragOver(event: DragEvent): void;
  onDrop(): void;
}): ReactNode {
  const { author, index, total, expanded, groups } = props;
  const name = displayName(author) || 'New author';
  const nav = 'min-h-11 rounded px-2 hover:bg-hover disabled:opacity-40';
  return (
    <div data-testid={`author-slot-${index}`} className={expanded ? 'rounded border border-secondary' : undefined}
      onDragStart={props.onDragStart} onDragOver={props.onDragOver} onDrop={props.onDrop}>
      <div className="flex items-center gap-1 px-1">
        <GripVertical aria-hidden className="size-4 shrink-0 text-muted" />
        <button type="button" data-testid={`author-select-${index}`} aria-expanded={expanded}
          onClick={props.onExpand} className="min-h-11 flex-1 rounded px-1 text-left hover:bg-hover">
          {name}
        </button>
        <button type="button" data-testid={`author-move-up-${index}`} aria-label="Move up"
          disabled={index === 0} onClick={props.onMoveUp} className={nav}>↑</button>
        <button type="button" data-testid={`author-move-down-${index}`} aria-label="Move down"
          disabled={index === total - 1} onClick={props.onMoveDown} className={nav}>↓</button>
        <button type="button" data-testid={`author-remove-${index}`} aria-label={`Remove ${name}`}
          onClick={props.onRemove} className={nav}>
          <X aria-hidden className="inline size-4" />
        </button>
      </div>
      {expanded && (
        <div data-testid={`author-card-${index}`}>
          <AuthorCard author={author} groups={groups} onChange={props.onChange} />
        </div>
      )}
    </div>
  );
}

// Undo toast shown after removing an author.
function UndoToast({ name, onUndo }: { name: string; onUndo: () => void }): ReactNode {
  return (
    <div role="status" className="mt-2 rounded bg-surface-low p-2 text-sm">
      Removed {name}
      <button type="button" data-testid="author-undo" onClick={onUndo}
        className="ml-2 min-h-11 rounded border border-secondary px-2 py-1 hover:bg-hover">
        Undo
      </button>
    </div>
  );
}

// The dialog's "Add author" button opening a fresh draft card.
function AddAuthorButton({ onClick }: { onClick: () => void }): ReactNode {
  return (
    <button type="button" data-testid="add-author-dialog" onClick={onClick}
      className="mt-2 min-h-11 rounded px-2 text-muted hover:bg-hover">
      <Plus aria-hidden className="inline size-3.5" />
      Add author
    </button>
  );
}

// Overlay and dialog frame with the title bar and close button.
function DialogShell({ onClose, children }: { onClose: () => void; children: ReactNode }): ReactNode {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black-08"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}>
      <div role="dialog" aria-modal="true" aria-label="Authors" data-testid="authors-dialog"
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded border border-secondary bg-white p-3 shadow">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Authors</h2>
          <button type="button" data-testid="authors-close" aria-label="Close" onClick={onClose}
            className="min-h-11 rounded hover:bg-hover">
            <X aria-hidden className="inline size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Authors dialog with ordered cards, drag/buttons reorder, remove with
 * Undo, and draft persistence gated on a non-empty family or literal
 * name.
 *
 * @param props - See {@link AuthorsDialogProps}.
 * @returns The dialog overlay with the card list and undo toast.
 */
export function AuthorsDialog({
  authors,
  setAuthors,
  initialIndex,
  startWithDraft = false,
  onClose,
}: AuthorsDialogProps): ReactNode {
  const [selected, setSelected] = useState<Selection>(startWithDraft ? 'draft' : initialIndex ?? 0);
  const [draft, setDraft] = useState<MetadataAuthor>(EMPTY_DRAFT);
  const ops = useAuthorOps(authors, setAuthors, setSelected);
  useEscape(onClose);
  const groups = groupsOf(authors);
  const onDraftChange = (next: MetadataAuthor): void => {
    if (!isNamed(next)) {
      setDraft(next);
      return;
    }
    setAuthors([...authors, { ...next, id: slugOf(next) }]);
    setDraft(EMPTY_DRAFT);
    setSelected(authors.length);
  };
  const startDraft = (): void => {
    setDraft(EMPTY_DRAFT);
    setSelected('draft');
  };
  return (
    <DialogShell onClose={onClose}>
      {authors.map((author, index) => (
        <CardSlot key={String(author.id ?? index)} author={author} index={index} total={authors.length}
          expanded={selected === index} groups={groups} onExpand={() => setSelected(index)}
          onChange={(next) => setAuthors(authors.map((a, i) => (i === index ? next : a)))}
          onMoveUp={() => ops.move(index, index - 1)} onMoveDown={() => ops.move(index, index + 1)}
          onRemove={() => ops.removeAt(index)} onDragStart={() => { ops.dragFrom.current = index; }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            const start = ops.dragFrom.current;
            ops.dragFrom.current = null;
            if (start !== null && start !== index) ops.move(start, index);
          }} />
      ))}
      {selected === 'draft' && (
        <div data-testid="author-card-draft">
          <AuthorCard author={draft} groups={groups} focusOrcid onChange={onDraftChange} />
        </div>
      )}
      <AddAuthorButton onClick={startDraft} />
      {ops.removed && <UndoToast name={displayName(ops.removed.author)} onUndo={ops.undo} />}
    </DialogShell>
  );
}

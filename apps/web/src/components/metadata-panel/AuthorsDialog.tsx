/**
 * Authors dialog of the manuscript metadata panel: a single author
 * form at a time (or the draft form for Add author) headed by an
 * `Author order: [ n v ] of M` select that reorders the author;
 * remove keeps its Undo toast. A draft writes to _author.yml only once
 * named, carrying buffered affiliation picks and new registry entries
 * into the same update. Escape closes; below 640px it is a sheet.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { isGroupAuthor } from '@opendraft/schema';
import type { MetadataAuthor } from './use-manuscript-metadata';
import { AuthorCard, type GroupOption } from './AuthorCard';
import { AffiliationPicker } from './AffiliationPicker';
import { pruneOrphans } from './affiliation-ops';
import { AuthorOrderHeader, DialogShell } from './authors-dialog-parts';
import type { AffiliationEntry } from './byline-model';
import { NARROW_QUERY, useMediaQuery } from '../../hooks/use-media-query';

/** Props for {@link AuthorsDialog}. */
export interface AuthorsDialogProps {
  /** Author entries in authorship order. */
  authors: MetadataAuthor[];
  /** Persist the new author list to _author.yml. */
  setAuthors: (authors: MetadataAuthor[]) => void;
  /** Author index to open the form for; defaults to the first author. */
  initialIndex?: number;
  /** Affiliation registry of _author.yml feeding the picker. */
  affiliations?: AffiliationEntry[];
  /** Persist registry/author changes from the affiliation picker. */
  setAffiliations?: (affiliations: AffiliationEntry[]) => void;
  /** Start with a new draft author form open. */
  startWithDraft?: boolean;
  /** Close the dialog. */
  onClose: () => void;
}

/** Undo toast visibility window. */
const UNDO_MS = 8000;

/** A person draft with no name fields filled in yet. */
const EMPTY_DRAFT: MetadataAuthor = { name: { given: '', family: '' } };

/** Change emitted by the affiliation picker: registry and/or authors. */
interface AffilChange { registry?: AffiliationEntry[]; authors?: MetadataAuthor[]; }

/** Buffered draft: the author being edited, registry picks, dirty flag. */
interface Draft { author: MetadataAuthor; registry: AffiliationEntry[]; dirty: boolean; }

// Fresh draft seeded from the current registry with nothing picked yet.
const freshDraft = (registry: AffiliationEntry[]): Draft =>
  ({ author: EMPTY_DRAFT, registry, dirty: false });

/** Form selection: an author index, the draft, or nothing after a removal. */
type Selection = number | 'draft' | null;

/** Removed author held by the undo toast. */
interface RemovedAuthor { author: MetadataAuthor; index: number; registry: AffiliationEntry[]; }

/** Reorder/remove/undo operations of the dialog. */
interface AuthorOps {
  removed: RemovedAuthor | null;
  move(from: number, to: number): void;
  removeAt(index: number): void;
  undo(): void;
}

// Coerce an author name into a plain string record.
function nameRecord(author: MetadataAuthor): Record<string, string> {
  const name = author.name;
  if (typeof name === 'string') return { family: name };
  if (name && typeof name === 'object' && !Array.isArray(name)) {
    return Object.fromEntries(Object.entries(name as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
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
const isNamed = (author: MetadataAuthor): boolean => Boolean(nameRecord(author).family || nameRecord(author).literal);

// Hidden author id slugged from the display name.
const slugOf = (author: MetadataAuthor): string => displayName(author).toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

function moved(authors: MetadataAuthor[], from: number, to: number): MetadataAuthor[] {
  const next = [...authors]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next;
}

// Group options for the "On behalf of" dropdown of every form.
function groupsOf(authors: MetadataAuthor[]): GroupOption[] {
  return authors.filter(isGroupAuthor).map((a) => ({ id: String(a.id ?? ''), name: displayName(a) }));
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
  wired: { registry: AffiliationEntry[]; setAffiliations?: (a: AffiliationEntry[]) => void },
): AuthorOps {
  const [removed, setRemoved] = useState<RemovedAuthor | null>(null);
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
    const remaining = authors.filter((_, i) => i !== index);
    setRemoved({ author: authors[index], index, registry: wired.registry });
    setAuthors(remaining);
    wired.setAffiliations?.(pruneOrphans(wired.registry, remaining));
    setSelected(authors.length === 1 ? null : Math.min(index, authors.length - 2));
  };
  const undo = (): void => {
    if (!removed) return;
    const restored = [...authors];
    restored.splice(removed.index, 0, removed.author);
    setAuthors(restored);
    if (wired.registry.length !== removed.registry.length) wired.setAffiliations?.(removed.registry);
    setSelected(removed.index);
    setRemoved(null);
  };
  return { removed, move, removeAt, undo };
}

// Affiliation picker under the open person form; forwards its changes.
function AffiliationSection({ authors, index, registry, onApply }: {
  authors: MetadataAuthor[]; index: number; registry: AffiliationEntry[];
  onApply: (change: AffilChange) => void;
}): ReactNode {
  return (
    <div data-testid="author-affiliation-section" className="px-2 pb-2">
      <h3 className="text-sm font-medium">Affiliation</h3>
      <AffiliationPicker registry={registry} authors={authors} authorIndex={index} onApply={onApply} />
    </div>
  );
}

// The single open author form: position header, editor card and the
// affiliation section for person authors.
function AuthorForm({ authors, index, groups, affiliations, setAuthors, setAffiliations, ops }: {
  authors: MetadataAuthor[]; index: number; groups: GroupOption[]; affiliations?: AffiliationEntry[];
  setAuthors(a: MetadataAuthor[]): void; setAffiliations?(a: AffiliationEntry[]): void; ops: AuthorOps;
}): ReactNode {
  const author = authors[index];
  const onApply = (change: AffilChange): void => {
    if (change.authors) setAuthors(change.authors);
    if (change.registry && setAffiliations) setAffiliations(change.registry);
  };
  return (
    <div data-testid={`author-card-${index}`}>
      <AuthorOrderHeader index={index} total={authors.length}
        onMove={(to) => ops.move(index, to)} onRemove={() => ops.removeAt(index)} />
      <AuthorCard author={author} groups={groups}
        onChange={(next) => setAuthors(authors.map((a, i) => (i === index ? next : a)))}
        affiliation={setAffiliations && !isGroupAuthor(author)
          ? <AffiliationSection authors={authors} index={index} registry={affiliations ?? []} onApply={onApply} />
          : undefined} />
    </div>
  );
}

/**
 * Authors dialog rendering only the selected author's form (or the
 * draft form for Add author) with the `Author order: [n] of M` select
 * that reorders the author. Remove keeps its Undo toast and
 * draft persistence stays gated on a non-empty family or literal name.
 * Below 640px the dialog is a full-screen sheet.
 *
 * @param props - See {@link AuthorsDialogProps}.
 * @returns The dialog frame with the single open form.
 */
export function AuthorsDialog({
  authors, setAuthors, affiliations, setAffiliations, initialIndex, startWithDraft = false, onClose,
}: AuthorsDialogProps): ReactNode {
  const [selected, setSelected] = useState<Selection>(startWithDraft ? 'draft' : initialIndex ?? 0);
  const [draft, setDraft] = useState<Draft>(() => freshDraft(affiliations ?? []));
  const ops = useAuthorOps(authors, setAuthors, setSelected,
    { registry: affiliations ?? [], setAffiliations });
  useEscape(onClose);
  const groups = groupsOf(authors);
  const onDraftAffiliation = (change: AffilChange): void => setDraft((d) => ({
    author: change.authors?.[change.authors.length - 1] ?? d.author,
    registry: change.registry ?? d.registry, dirty: d.dirty || change.registry !== undefined,
  }));
  const onDraftChange = (next: MetadataAuthor): void => {
    if (!isNamed(next)) { setDraft((d) => ({ ...d, author: next })); return; }
    setAuthors([...authors, { ...next, id: slugOf(next) }]);
    if (draft.dirty) setAffiliations?.(draft.registry);
    setDraft(freshDraft(affiliations ?? []));
    setSelected(authors.length);
  };
  const startDraft = (): void => { setDraft(freshDraft(affiliations ?? [])); setSelected('draft'); };
  const narrow = useMediaQuery(NARROW_QUERY); const index = typeof selected === 'number' ? selected : null;
  const draftCard = (
    <div data-testid="author-card-draft">
      <AuthorCard author={draft.author} groups={groups} focusOrcid onChange={onDraftChange}
        affiliation={<AffiliationSection authors={[...authors, draft.author]} index={authors.length}
          registry={draft.registry} onApply={onDraftAffiliation} />} />
    </div>
  );
  return (
    <DialogShell narrow={narrow} onClose={onClose}>
      {index !== null && authors[index] !== undefined && (
        <AuthorForm authors={authors} index={index} groups={groups} affiliations={affiliations}
          setAuthors={setAuthors} setAffiliations={setAffiliations} ops={ops} />
      )}
      {selected === 'draft' && draftCard}
      <button type="button" data-testid="add-author-dialog" onClick={startDraft}
        className="mt-2 min-h-11 rounded px-2 text-muted hover:bg-hover">
        <Plus aria-hidden className="inline size-3.5" /> Add author
      </button>
      {ops.removed && (
        <div role="status" className="mt-2 rounded bg-surface-low p-2 text-sm">
          Removed {displayName(ops.removed.author)}
          <button type="button" data-testid="author-undo" onClick={ops.undo}
            className="ml-2 min-h-11 rounded border border-secondary px-2 py-1 hover:bg-hover">Undo</button>
        </div>
      )}
    </DialogShell>
  );
}

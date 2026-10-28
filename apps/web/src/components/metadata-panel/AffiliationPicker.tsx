/**
 * Affiliation picker of the manuscript metadata panel.
 *
 * Registry suggestions ("used by N") and ROR v2 results (300ms debounce
 * at 5 characters, stale queries abort, IndexedDB cache) render in a
 * multi-select listbox popover whenever the combobox is open; clicking
 * an option toggles the author's ref while the listbox stays open and
 * clears the search text to '' (placeholder shows), and selected
 * options show a check with aria-selected. Selected affiliations also
 * render as removable chips below the listbox, dropping and pruning
 * the entry on removal. Focus with an empty query lists the registry
 * entries in use; Escape and outside clicks close the list and clear
 * the query. "Create manually" and "Normalize to references" are
 * footer actions. "Independent researcher" is a
 * controlled checkbox checked while the author references the built-in
 * entry: checking hides the combobox, listbox and create action;
 * unchecking removes the ref (pruning the entry when unused) and shows
 * them again; the row is hidden while the author has any other
 * affiliation. Manual entries append to the _author.yml registry and
 * add an author ref; the edit sheet warns when an entry is shared by
 * several authors; legacy inline affiliations normalize to registry
 * entries plus refs. Pure operations live in affiliation-ops.ts.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AffiliationListbox, IndependentRow, INPUT, SearchField, useOutsideClose,
  type RegistrySuggestion,
} from './affiliation-listbox';
import { AffiliationChips } from './affiliation-chips';
import {
  createOps, hasInline, hasRef, nameOf, refUsage,
  type AffilChange, type PickerOps,
} from './affiliation-ops';
import { searchRorOrgs, type RorOrg } from './ror-client';
import type { AffiliationEntry } from './byline-model';
import type { MetadataAuthor } from './use-manuscript-metadata';

/** Props for {@link AffiliationPicker}. */
export interface AffiliationPickerProps {
  registry: AffiliationEntry[]; // top-level registry of _author.yml
  authors: MetadataAuthor[]; // all authors, for refs and the shared warning
  authorIndex?: number; // author receiving picked entries (default 0)
  onApply: (change: AffilChange) => void;
}

const ROR_MIN_CHARS = 5; // ROR is searched only from five characters
const ROR_DEBOUNCE_MS = 300; // debounce between the last keystroke and fetch
const ROW = 'block min-h-11 w-full rounded px-2 text-left text-muted hover:bg-hover'; // action rows

/** Debounced ROR search wiring: aborts stale queries, fails silently.
 * Short queries keep the last results; the picker clears them on close. */
function useRorResults(query: string, setResults: (items: RorOrg[]) => void): void {
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => {
    const q = query.trim();
    controllerRef.current?.abort();
    controllerRef.current = null;
    if (q.length < ROR_MIN_CHARS) return undefined; // keep last results so a cleared pick keeps its row
    setResults([]);
    const controller = new AbortController();
    controllerRef.current = controller;
    const timer = setTimeout(() => {
      void searchRorOrgs(q, { signal: controller.signal }).then(
        (items) => { if (!controller.signal.aborted) setResults(items); },
        () => { /* aborted or failed: stay silent */ },
      );
    }, ROR_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, setResults]);
}

// Registry suggestions for the current query: name matches, or the
// entries in use while the query is empty.
function suggestionsOf(
  registry: AffiliationEntry[], authors: MetadataAuthor[], query: string,
): RegistrySuggestion[] {
  const q = query.trim().toLowerCase();
  return registry
    .map((entry, index) => ({ entry, index, usage: refUsage(authors, String(entry.id)) }))
    .filter(({ entry, usage }) => (q === '' ? usage > 0 : nameOf(entry).toLowerCase().includes(q)));
}

// Name/city/country fields shared by the manual form and the edit sheet.
function EntryFields(props: {
  prefix: string; entry: Record<string, string>; set: (patch: Record<string, string>) => void;
}): ReactNode {
  const field = (key: 'name' | 'city' | 'country', label: string): ReactNode => (
    <label key={key} className="block text-sm">{label}
      <input data-testid={`affiliation-${props.prefix}-${key}`} value={props.entry[key] ?? ''} className={INPUT}
        onChange={(event) => props.set({ [key]: event.target.value })} />
    </label>
  );
  return <>{field('name', 'Affiliation name')}{field('city', 'City')}{field('country', 'Country code')}</>;
}

// Manual-create sheet; empty names are refused.
function ManualForm({ onCreate, onClose }: {
  onCreate(fields: { name: string; city?: string; country?: string }): void; onClose(): void;
}): ReactNode {
  const [fields, setFields] = useState<Record<string, string>>({ name: '', city: '', country: '' });
  const save = (): void => {
    const name = fields.name.trim();
    if (!name) return;
    const city = fields.city.trim();
    const country = fields.country.trim();
    onCreate({ name, ...(city ? { city } : {}), ...(country ? { country } : {}) });
  };
  return (
    <div data-testid="affiliation-manual" className="rounded border border-secondary p-2">
      <EntryFields prefix="manual" entry={fields} set={(p) => setFields((f) => ({ ...f, ...p }))} />
      <button type="button" data-testid="affiliation-manual-save" onClick={save}
        className="min-h-11 rounded border border-secondary px-2 hover:bg-hover">Add</button>
      <button type="button" data-testid="affiliation-manual-cancel" onClick={onClose}
        className="ml-1 min-h-11 rounded px-2 text-muted hover:bg-hover">Cancel</button>
    </div>
  );
}

// Nested edit sheet carrying the shared-edit warning.
function EditSheet(props: {
  entry: AffiliationEntry; usage: number;
  onSave(patch: Record<string, string>): void; onClose(): void;
}): ReactNode {
  const [fields, setFields] = useState<Record<string, string>>({
    name: String(props.entry.name ?? ''), city: String(props.entry.city ?? ''),
    country: String(props.entry.country ?? ''),
  });
  return (
    <div data-testid="affiliation-edit-sheet" className="rounded border border-secondary p-2">
      {props.usage >= 2 && (
        <p data-testid="affiliation-shared-warning" className="text-amber-800">
          Shared by {props.usage} authors
        </p>
      )}
      <EntryFields prefix="edit" entry={fields} set={setFields} />
      <button type="button" data-testid="affiliation-edit-save" onClick={() => props.onSave(fields)}
        className="min-h-11 rounded border border-secondary px-2 hover:bg-hover">Save</button>
      <button type="button" data-testid="affiliation-edit-close" onClick={props.onClose}
        className="ml-1 min-h-11 rounded px-2 text-muted hover:bg-hover">Close</button>
    </div>
  );
}

/** Props for {@link PickerActions}. */
interface PickerActionsProps {
  authors: MetadataAuthor[]; // inline-affiliation detection and edit usage
  ops: PickerOps; // manual create and entry editing
  manual: boolean; // manual-create sheet open
  editing: AffiliationEntry | null; // entry being edited, if any
  showCreate: boolean; // hidden while the author is independent
  onManual: (open: boolean) => void; // open/close the manual sheet
  onSaved: () => void; // clear the edit state after save/close
}

// Footer actions: manual create, entry editing, legacy normalization.
function PickerActions(props: PickerActionsProps): ReactNode {
  return (
    <>
      {props.showCreate && (
        <button type="button" data-testid="affiliation-create-manual" onClick={() => props.onManual(true)} className={ROW}>
          Create manually
        </button>
      )}
      {props.manual && <ManualForm onCreate={(f) => { props.ops.addManual(f); props.onManual(false); }}
        onClose={() => props.onManual(false)} />}
      {props.editing && <EditSheet entry={props.editing} usage={refUsage(props.authors, String(props.editing.id))}
        onSave={(patch) => { props.ops.saveEntry(String(props.editing.id), patch); props.onSaved(); }}
        onClose={props.onSaved} />}
      {hasInline(props.authors) && (
        <button type="button" data-testid="affiliation-normalize" onClick={props.ops.normalize} className={ROW}>
          Normalize to references
        </button>
      )}
    </>
  );
}

/**
 * Pick or edit an affiliation for one author.
 *
 * @param props - See {@link AffiliationPickerProps}.
 * @returns The combobox field, multi-select suggestion listbox,
 *   independent checkbox, footer actions and sheets.
 */
export function AffiliationPicker({
  registry, authors, authorIndex = 0, onApply,
}: AffiliationPickerProps): ReactNode {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [ror, setRor] = useState<RorOrg[]>([]);
  const [manual, setManual] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const close = (): void => {
    setOpen(false); setEditIndex(null); setQuery(''); setRor([]);
  };
  useRorResults(query, setRor);
  useOutsideClose(rootRef, open, close);
  const ops = createOps(registry, authors, authorIndex, onApply);
  const target = authors[authorIndex];
  const independent = hasRef(target, 'independent');
  const hasOther = Array.isArray(target?.affiliations) && target.affiliations.some(
    (item) => (item as { ref?: unknown }).ref !== 'independent');
  // While the author carries other affiliations the checkbox is hidden, so a
  // lingering independent ref must not hide the combobox either.
  const solo = !hasOther && independent; // checkbox visible and checked
  const toggleIndependent = (next: boolean): void => {
    (next ? ops.addIndependent : () => ops.toggleRef('independent'))();
    setQuery(''); setManual(false); close();
  };
  const editing = editIndex === null ? null : registry[editIndex] ?? null;
  return (
    <div ref={rootRef} data-testid="affiliation-picker" className="space-y-1">
      {!solo && (
        <>
          <SearchField query={query} open={open} onOpen={() => setOpen(true)} onClose={close}
            onQuery={(text) => { setQuery(text); setEditIndex(null); setOpen(true); }} />
          {open && (
            <AffiliationListbox registry={suggestionsOf(registry, authors, query)} ror={ror}
              isSelected={(id) => hasRef(target, id)}
              isRorSelected={(org) => registry.some((e) => e.ror && e.ror === org.ror
                && hasRef(target, String(e.id)))}
              onPickRef={(id) => { ops.toggleRef(id); setQuery(''); }} onEdit={setEditIndex}
              onPickOrg={(org) => { ops.toggleOrg(org); setQuery(''); }} />
          )}
        </>
      )}
      <AffiliationChips author={target} registry={registry} onRemove={ops.toggleRef} />
      {!hasOther && <IndependentRow checked={independent} onChange={toggleIndependent} />}
      <PickerActions authors={authors} ops={ops} manual={manual} editing={editing}
        showCreate={!solo} onManual={setManual} onSaved={() => setEditIndex(null)} />
    </div>
  );
}

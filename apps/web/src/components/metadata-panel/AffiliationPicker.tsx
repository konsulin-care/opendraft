/**
 * Affiliation picker of the manuscript metadata panel.
 *
 * Registry suggestions ("used by N") and ROR v2 results (300ms debounce
 * at 5 characters, stale queries abort, IndexedDB cache) render in a
 * multi-select listbox popover whenever the combobox is open; clicking
 * an option toggles the author's ref while the listbox stays open with
 * the query intact, and selected options show a check with
 * aria-selected. Selected affiliations also render as removable chips
 * below the listbox, dropping and pruning the entry on removal.
 * Focus with an empty query lists the registry entries
 * in use; Escape and outside clicks close the list. "Create manually"
 * and "Normalize to references" are footer actions, "Independent
 * researcher" is a checkbox shown only while the author has zero
 * affiliations. Manual entries append to the _author.yml registry and
 * add an author ref; the edit sheet warns when an entry is shared by
 * several authors; legacy inline affiliations normalize to registry
 * entries plus refs. Pure operations live in affiliation-ops.ts.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AffiliationListbox, IndependentRow, INPUT, SearchField, useOutsideClose,
} from './affiliation-listbox';
import { AffiliationChips } from './affiliation-chips';
import {
  createOps, hasInline, hasRef, nameOf, refUsage, type AffilChange,
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

/** Debounced ROR search wiring: aborts stale queries, fails silently. */
function useRorResults(query: string, setResults: (items: RorOrg[]) => void): void {
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => {
    const q = query.trim();
    controllerRef.current?.abort();
    controllerRef.current = null;
    setResults([]);
    if (q.length < ROR_MIN_CHARS) return undefined;
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
  const close = (): void => { setOpen(false); setEditIndex(null); };
  useRorResults(query, setRor);
  useOutsideClose(rootRef, open, close);
  const ops = createOps(registry, authors, authorIndex, onApply);
  const pick = (apply: () => void): void => { apply(); setQuery(''); close(); };
  const q = query.trim().toLowerCase();
  const target = authors[authorIndex];
  const suggestions = registry
    .map((entry, index) => ({ entry, index, usage: refUsage(authors, String(entry.id)) }))
    .filter(({ entry, usage }) => (q === '' ? usage > 0 : nameOf(entry).toLowerCase().includes(q)));
  const editing = editIndex === null ? null : registry[editIndex] ?? null;
  const noAffiliations = !Array.isArray(target?.affiliations) || target.affiliations.length === 0;
  return (
    <div ref={rootRef} data-testid="affiliation-picker" className="space-y-1">
      <SearchField query={query} open={open} onOpen={() => setOpen(true)} onClose={close}
        onQuery={(text) => { setQuery(text); setEditIndex(null); setOpen(true); }} />
      {open && (
        <AffiliationListbox registry={suggestions} ror={ror}
          isSelected={(id) => hasRef(target, id)}
          isRorSelected={(org) => registry.some((e) => e.ror && e.ror === org.ror
            && hasRef(target, String(e.id)))}
          onPickRef={ops.toggleRef} onEdit={setEditIndex} onPickOrg={ops.toggleOrg} />
      )}
      <AffiliationChips author={target} registry={registry} onRemove={ops.toggleRef} />
      {noAffiliations && <IndependentRow onPick={() => pick(ops.addIndependent)} />}
      <button type="button" data-testid="affiliation-create-manual" onClick={() => setManual(true)} className={ROW}>
        Create manually
      </button>
      {manual && <ManualForm onCreate={(f) => { ops.addManual(f); setManual(false); }}
        onClose={() => setManual(false)} />}
      {editing && <EditSheet entry={editing} usage={refUsage(authors, String(editing.id))}
        onSave={(patch) => { ops.saveEntry(String(editing.id), patch); setEditIndex(null); }}
        onClose={() => setEditIndex(null)} />}
      {hasInline(authors) && (
        <button type="button" data-testid="affiliation-normalize" onClick={ops.normalize} className={ROW}>
          Normalize to references
        </button>
      )}
    </div>
  );
}

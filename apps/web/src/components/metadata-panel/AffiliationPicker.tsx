/**
 * Affiliation picker of the manuscript metadata panel.
 *
 * Registry suggestions ("used by N") and ROR v2 results (300ms debounce
 * at 5 characters, stale queries abort, IndexedDB cache) render in a
 * listbox popover only while a query is open; selecting clears the query
 * and closes the list, Escape and outside clicks close it too.
 * "Create manually" and "Normalize to references" are footer actions,
 * "Independent researcher" is a checkbox shown only while the author
 * has zero affiliations. Manual entries append to the _author.yml
 * registry and add an author ref; the edit sheet warns when an entry is
 * shared by several authors; legacy inline affiliations normalize to
 * registry entries plus refs.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AffiliationListbox, IndependentRow, INPUT, nameOf, SearchField, useOutsideClose,
} from './affiliation-listbox';
import { searchRorOrgs, type RorOrg } from './ror-client';
import type { AffiliationEntry } from './byline-model';
import type { MetadataAuthor } from './use-manuscript-metadata';

/** Props for {@link AffiliationPicker}. */
export interface AffiliationPickerProps {
  registry: AffiliationEntry[]; // top-level registry of _author.yml
  authors: MetadataAuthor[]; // all authors, for refs and the shared warning
  authorIndex?: number; // author receiving picked entries (default 0)
  onApply: (change: { registry?: AffiliationEntry[]; authors?: MetadataAuthor[] }) => void;
}

const ROR_MIN_CHARS = 5; // ROR is searched only from five characters
const ROR_DEBOUNCE_MS = 300; // debounce between the last keystroke and fetch
const ROW = 'block min-h-11 w-full rounded px-2 text-left text-muted hover:bg-hover'; // action rows

/** Slugify free text into a kebab-case registry id base; '' when empty. */
export const slugify = (text: string): string =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** First unused id derived from a base: base, base-2, base-3 ... */
export function uniqueId(base: string, registry: AffiliationEntry[]): string {
  const root = base || 'affiliation';
  let id = root;
  for (let n = 2; registry.some((e) => e.id === id); n += 1) id = `${root}-${n}`;
  return id;
}

/** Append a registry ref to one author's affiliations, deduped. */
export function withRef(author: MetadataAuthor, id: string): MetadataAuthor {
  const list = Array.isArray(author.affiliations) ? author.affiliations : [];
  return list.some((item) => (item as { ref?: unknown }).ref === id)
    ? author : { ...author, affiliations: [...list, { ref: id }] };
}

/** How many authors reference one registry id. */
export const refUsage = (authors: MetadataAuthor[], id: string): number => authors.filter(
  (a) => Array.isArray(a.affiliations)
    && a.affiliations.some((item) => (item as { ref?: unknown }).ref === id),
).length;

// A legacy inline affiliation: a named object without a ref.
const isInline = (item: unknown): boolean =>
  typeof item === 'object' && item !== null && !('ref' in item)
  && typeof (item as { name?: unknown }).name === 'string';

/** Whether any author still carries legacy inline affiliations. */
export const hasInline = (authors: MetadataAuthor[]): boolean => authors.some(
  (a) => Array.isArray(a.affiliations) && a.affiliations.some(isInline),
);

/** Convert legacy inline affiliations into registry entries plus refs. */
export function normalizeToRefs(
  authors: MetadataAuthor[],
  registry: AffiliationEntry[],
): { authors: MetadataAuthor[]; registry: AffiliationEntry[] } {
  const nextRegistry = [...registry];
  const nextAuthors = authors.map((author) => {
    const list = Array.isArray(author.affiliations) ? author.affiliations : [];
    if (!list.some(isInline)) return author;
    const replaced = list.map((item) => {
      if (!isInline(item)) return item;
      const source = item as AffiliationEntry;
      const entry = { ...source, id: uniqueId(slugify(nameOf(source)), nextRegistry) };
      nextRegistry.push(entry);
      return { ref: entry.id };
    });
    return { ...author, affiliations: replaced };
  });
  return { authors: nextAuthors, registry: nextRegistry };
}

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

/** Registry/author mutations shared by the rows and sheets. */
interface PickerOps {
  addOrg(org: RorOrg): void;
  addRef(id: string): void;
  addIndependent(): void;
  addManual(fields: { name: string; city?: string; country?: string }): void;
  saveEntry(id: string, patch: Record<string, string>): void;
  normalize(): void;
}

// Build the picker operations over one registry/author snapshot.
function createOps(
  registry: AffiliationEntry[],
  authors: MetadataAuthor[],
  authorIndex: number,
  onApply: NonNullable<AffiliationPickerProps['onApply']>,
): PickerOps {
  const addRefTo = (id: string, nextRegistry?: AffiliationEntry[]): void => {
    const next = authors.map((a, i) => (i === authorIndex ? withRef(a, id) : a));
    onApply(nextRegistry ? { registry: nextRegistry, authors: next } : { authors: next });
  };
  return {
    addOrg: (org) => {
      const reused = registry.find((e) => e.ror === org.ror && e.ror);
      if (reused) { addRefTo(String(reused.id)); return; }
      const entry: AffiliationEntry = {
        id: uniqueId(slugify(org.name), registry), name: org.name,
        ...(org.city ? { city: org.city } : {}), ...(org.country ? { country: org.country } : {}),
        ror: org.ror,
      };
      addRefTo(entry.id, [...registry, entry]);
    },
    addRef: (id) => addRefTo(id),
    addIndependent: () => {
      const id = 'independent';
      addRefTo(id, registry.some((e) => e.id === id)
        ? undefined : [...registry, { id, name: 'Independent researcher' }]);
    },
    addManual: (fields) => {
      const entry: AffiliationEntry = { id: uniqueId(slugify(fields.name), registry), ...fields };
      addRefTo(entry.id, [...registry, entry]);
    },
    saveEntry: (id, patch) => onApply({
      registry: registry.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }),
    normalize: () => onApply(normalizeToRefs(authors, registry)),
  };
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
 * @returns The combobox field, suggestion listbox, independent checkbox,
 *   footer actions and sheets.
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
  const suggestions = registry
    .map((entry, index) => ({ entry, index, usage: refUsage(authors, String(entry.id)) }))
    .filter(({ entry }) => nameOf(entry).toLowerCase().includes(q));
  const editing = editIndex === null ? null : registry[editIndex] ?? null;
  const target = authors[authorIndex];
  const noAffiliations = !Array.isArray(target?.affiliations) || target.affiliations.length === 0;
  return (
    <div ref={rootRef} data-testid="affiliation-picker" className="space-y-1">
      <SearchField query={query} open={open} onOpen={() => setOpen(true)} onClose={close}
        onQuery={(text) => { setQuery(text); setEditIndex(null); setOpen(true); }} />
      {open && q !== '' && (
        <AffiliationListbox registry={suggestions} ror={ror}
          onPickRef={(id) => pick(() => ops.addRef(id))} onEdit={setEditIndex}
          onPickOrg={(org) => pick(() => ops.addOrg(org))} />
      )}
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

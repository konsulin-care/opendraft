/**
 * Affiliation picker of the manuscript metadata panel.
 *
 * Registry suggestions come first ("used by N"), then ROR v2 results
 * fetched after a 300ms debounce at 5 characters — stale queries abort
 * and land in an IndexedDB cache. "Independent researcher", manual
 * entries append to the _author.yml registry and add an author ref; the
 * edit sheet warns when an entry is shared by several authors; legacy
 * inline affiliations normalize to registry entries plus refs.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
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
const INPUT = 'min-h-11 w-full outline-none'; // borderless, touch-sized input
const ROW = 'block min-h-11 w-full rounded px-2 text-left text-muted hover:bg-hover'; // action rows

/** Lowercase display name of a registry entry. */
const nameOf = (entry: AffiliationEntry): string =>
  typeof entry.name === 'string' ? entry.name : String(entry.id ?? '');

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

// Registry suggestion row: pick target plus edit affordance.
function RegistryRow(props: {
  entry: AffiliationEntry; index: number; usage: number; onPick(): void; onEdit(): void;
}): ReactNode {
  return (
    <div className="flex items-center gap-1">
      <button type="button" data-testid={`affiliation-registry-item-${props.index}`} onClick={props.onPick}
        className="min-h-11 flex-1 rounded px-2 text-left hover:bg-hover">
        {nameOf(props.entry)}<span className="text-muted"> used by {props.usage}</span>
      </button>
      <button type="button" data-testid={`affiliation-edit-${props.index}`} onClick={props.onEdit}
        className="min-h-11 rounded px-2 text-muted hover:bg-hover">Edit</button>
    </div>
  );
}

// One ROR suggestion row with city and country.
function RorRow({ org, index, onPick }: { org: RorOrg; index: number; onPick(): void }): ReactNode {
  return (
    <button type="button" data-testid={`affiliation-ror-item-${index}`} onClick={onPick}
      className="block min-h-11 w-full rounded px-2 text-left hover:bg-hover">
      {org.name}
      {org.city ? <span className="text-muted">, {org.city}</span> : null}
      {org.country ? <span className="text-muted"> · {org.country}</span> : null}
    </button>
  );
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
 * @returns The search field, suggestion lists, action buttons and sheets.
 */
export function AffiliationPicker({
  registry, authors, authorIndex = 0, onApply,
}: AffiliationPickerProps): ReactNode {
  const [query, setQuery] = useState('');
  const [ror, setRor] = useState<RorOrg[]>([]);
  const [manual, setManual] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  useRorResults(query, setRor);
  const ops = createOps(registry, authors, authorIndex, onApply);
  const q = query.trim().toLowerCase();
  const matches = registry
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => nameOf(entry).toLowerCase().includes(q));
  const editing = editIndex === null ? null : registry[editIndex] ?? null;
  return (
    <div data-testid="affiliation-picker" className="space-y-1">
      <input data-testid="affiliation-search" aria-label="Search affiliations" value={query}
        placeholder="Affiliation" className={INPUT}
        onChange={(event) => { setQuery(event.target.value); setEditIndex(null); }} />
      {matches.map(({ entry, index }) => (
        <RegistryRow key={String(entry.id ?? index)} entry={entry} index={index}
          usage={refUsage(authors, String(entry.id))}
          onPick={() => ops.addRef(String(entry.id))} onEdit={() => setEditIndex(index)} />
      ))}
      {ror.map((org, index) => (
        <RorRow key={org.ror} org={org} index={index} onPick={() => ops.addOrg(org)} />
      ))}
      <button type="button" data-testid="affiliation-independent" onClick={ops.addIndependent} className={ROW}>
        Independent researcher
      </button>
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

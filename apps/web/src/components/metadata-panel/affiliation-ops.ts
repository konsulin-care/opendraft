/**
 * Pure registry/author operations of the affiliation picker.
 *
 * Every function works on plain data (one registry snapshot plus the
 * author list) and returns or applies the next snapshot, so the picker,
 * the draft buffer in the authors dialog and the tests share a single
 * implementation: adding and toggling refs with orphan pruning, id
 * derivation, and normalizing legacy inline affiliations.
 */
import type { RorOrg } from './ror-client';
import type { AffiliationEntry } from './byline-model';
import type { MetadataAuthor } from './use-manuscript-metadata';

/** One change the picker applies to the registry and/or the authors. */
export interface AffilChange {
  registry?: AffiliationEntry[]; // present when the registry changed
  authors?: MetadataAuthor[]; // present when the author list changed
}

/** Display name of a registry entry, falling back to its id. */
export const nameOf = (entry: AffiliationEntry): string =>
  typeof entry.name === 'string' ? entry.name : String(entry.id ?? '');

/** Slugify free text into a kebab-case registry id base; '' when empty. */
export const slugify = (text: string): string =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/**
 * First unused id derived from a base.
 *
 * @param base - Kebab-case id base; `'affiliation'` when empty.
 * @param registry - Current registry whose ids must be avoided.
 * @returns `base`, then `base-2`, `base-3` ... until one is free.
 */
export function uniqueId(base: string, registry: AffiliationEntry[]): string {
  const root = base || 'affiliation';
  let id = root;
  for (let n = 2; registry.some((e) => e.id === id); n += 1) id = `${root}-${n}`;
  return id;
}

/**
 * Append a registry ref to one author's affiliations, deduped.
 *
 * @param author - Author receiving the ref.
 * @param id - Registry id to reference.
 * @returns The author with `{ ref: id }` appended, or unchanged if present.
 */
export function withRef(author: MetadataAuthor, id: string): MetadataAuthor {
  const list = Array.isArray(author.affiliations) ? author.affiliations : [];
  return list.some((item) => (item as { ref?: unknown }).ref === id)
    ? author : { ...author, affiliations: [...list, { ref: id }] };
}

/**
 * Drop one registry ref from one author's affiliations.
 *
 * @param author - Author losing the ref; other affiliations stay intact.
 * @param id - Registry id to remove.
 * @returns The author without any `{ ref: id }` item.
 */
export function withoutRef(author: MetadataAuthor, id: string): MetadataAuthor {
  const list = Array.isArray(author.affiliations) ? author.affiliations : [];
  return { ...author, affiliations: list.filter((item) => (item as { ref?: unknown }).ref !== id) };
}

/**
 * Whether an author references one registry entry.
 *
 * @param author - Author to inspect (`undefined` never references).
 * @param id - Registry id searched among the author's affiliations.
 * @returns True when the author carries `{ ref: id }`.
 */
export function hasRef(author: MetadataAuthor | undefined, id: string): boolean {
  return Boolean(author && Array.isArray(author.affiliations)
    && author.affiliations.some((item) => (item as { ref?: unknown }).ref === id));
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

/**
 * Remove one registry ref from one author, pruning the entry if orphaned.
 *
 * @param registry - Current affiliation registry.
 * @param authors - All authors of the manuscript.
 * @param authorIndex - Author losing the ref.
 * @param id - Registry id to remove.
 * @returns Authors only while other authors still reference the entry;
 *   registry plus authors once no author references it anymore.
 */
export function removeRef(
  registry: AffiliationEntry[],
  authors: MetadataAuthor[],
  authorIndex: number,
  id: string,
): AffilChange {
  const next = authors.map((a, i) => (i === authorIndex ? withoutRef(a, id) : a));
  if (refUsage(next, id) > 0) return { authors: next };
  const remaining = registry.filter((e) => String(e.id) !== id);
  return remaining.length === registry.length
    ? { authors: next } : { registry: remaining, authors: next };
}

/**
 * Drop registry entries that no author references anymore.
 *
 * @param registry - Current affiliation registry.
 * @param authors - Author list to measure references against.
 * @returns The registry without orphaned entries.
 */
export function pruneOrphans(
  registry: AffiliationEntry[],
  authors: MetadataAuthor[],
): AffiliationEntry[] {
  return registry.filter((e) => refUsage(authors, String(e.id)) > 0);
}

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

/** Registry/author mutations shared by the rows and sheets. */
export interface PickerOps {
  addOrg(org: RorOrg): void; // add a ROR organization and reference it
  addRef(id: string): void; // reference an existing registry entry
  addIndependent(): void; // ensure and reference the built-in entry
  addManual(fields: { name: string; city?: string; country?: string }): void;
  saveEntry(id: string, patch: Record<string, string>): void; // edit one entry
  normalize(): void; // rewrite legacy inline affiliations to refs
  toggleRef(id: string): void; // add the ref, or remove and prune it
  toggleOrg(org: RorOrg): void; // add the org, or remove and prune it
}

/**
 * Build the picker operations over one registry/author snapshot.
 *
 * @param registry - Current affiliation registry of `_author.yml`.
 * @param authors - All authors, for refs and shared-entry decisions.
 * @param authorIndex - Author receiving or dropping the refs.
 * @param onApply - Applies each change to the surrounding state.
 * @returns The add/edit/normalize/toggle operations (see {@link PickerOps}).
 */
export function createOps(
  registry: AffiliationEntry[],
  authors: MetadataAuthor[],
  authorIndex: number,
  onApply: (change: AffilChange) => void,
): PickerOps {
  const target = authors[authorIndex];
  const addRefTo = (id: string, next?: AffiliationEntry[]): void => {
    const updated = authors.map((a, i) => (i === authorIndex ? withRef(a, id) : a));
    onApply(next ? { registry: next, authors: updated } : { authors: updated });
  };
  const addEntry = (entry: AffiliationEntry): void => addRefTo(entry.id, [...registry, entry]);
  const addOrgOp = (org: RorOrg): void => {
    const reused = registry.find((e) => e.ror && e.ror === org.ror);
    if (reused) { addRefTo(String(reused.id)); return; }
    addEntry({ id: uniqueId(slugify(org.name), registry), name: org.name,
      ...(org.city ? { city: org.city } : {}), ...(org.country ? { country: org.country } : {}),
      ror: org.ror });
  };
  const toggleRefOp = (id: string): void => {
    if (hasRef(target, id)) { onApply(removeRef(registry, authors, authorIndex, id)); return; }
    addRefTo(id);
  };
  const toggleOrgOp = (org: RorOrg): void => {
    const reused = registry.find((e) => e.ror && e.ror === org.ror);
    if (reused && hasRef(target, String(reused.id))) {
      onApply(removeRef(registry, authors, authorIndex, String(reused.id))); return;
    }
    addOrgOp(org);
  };
  return {
    addOrg: addOrgOp,
    addRef: addRefTo,
    addIndependent: () => (registry.some((e) => e.id === 'independent')
      ? addRefTo('independent') : addEntry({ id: 'independent', name: 'Independent researcher' })),
    addManual: (fields) => addEntry({ id: uniqueId(slugify(fields.name), registry), ...fields }),
    saveEntry: (id, patch) => onApply(
      { registry: registry.map((e) => (e.id === id ? { ...e, ...patch } : e)) }),
    normalize: () => onApply(normalizeToRefs(authors, registry)),
    toggleRef: toggleRefOp,
    toggleOrg: toggleOrgOp,
  };
}

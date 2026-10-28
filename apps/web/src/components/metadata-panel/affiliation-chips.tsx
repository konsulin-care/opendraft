/**
 * Selected-affiliation chips of the affiliation picker.
 *
 * One chip per registry entry the author references, rendered below
 * the combobox and listbox; each chip carries a remove button
 * labelled "Remove <name>" that drops the ref (and prunes the entry
 * when no author references it anymore). The built-in "independent"
 * ref is never rendered as a chip.
 */
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { nameOf } from './affiliation-ops';
import type { AffiliationEntry } from './byline-model';
import type { MetadataAuthor } from './use-manuscript-metadata';

/** Props for {@link AffiliationChips}. */
export interface AffiliationChipsProps {
  author?: MetadataAuthor; // author whose refs render as chips
  registry: AffiliationEntry[]; // registry resolving ref ids to names
  onRemove: (id: string) => void; // drop the ref, pruning if orphaned
}

/**
 * Chips of the author's selected affiliations.
 *
 * @param props - See {@link AffiliationChipsProps}.
 * @returns A chip list below the combobox, or null when the author
 *   references no chip-eligible registry entry.
 */
export function AffiliationChips({ author, registry, onRemove }: AffiliationChipsProps): ReactNode {
  const list = Array.isArray(author?.affiliations) ? author.affiliations : [];
  const refs = [...new Set(list.map((item) => (item as { ref?: unknown }).ref)
    .filter((ref): ref is string => typeof ref === 'string' && ref !== 'independent'))];
  if (refs.length === 0) return null;
  return (
    <ul data-testid="affiliation-chips" className="flex flex-wrap gap-1 pt-1">
      {refs.map((id) => {
        const entry = registry.find((e) => String(e.id) === id);
        const name = entry ? nameOf(entry) : id;
        return (
          <li key={id} data-testid={`affiliation-chip-${id}`}
            className="flex min-h-9 items-center gap-1 rounded border border-secondary px-2 text-sm">
            {name}
            <button type="button" data-testid={`affiliation-chip-remove-${id}`}
              aria-label={`Remove ${name}`} onClick={() => onRemove(id)}
              className="rounded hover:bg-hover">
              <X aria-hidden className="inline size-3.5" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Listbox popover and combobox controls of the affiliation picker.
 *
 * Registry suggestions used in the manuscript and ROR matches render
 * inside a role="listbox" popover with aria-multiselectable; options
 * carry aria-selected and a check mark while the author references
 * them, so picking toggles refs while the popover stays open. "Create
 * manually" and "Normalize to references" stay outside as footer
 * actions. The search field is an ARIA combobox that closes the
 * popover on Escape (without closing the dialog while open); the
 * picker also closes it on any mousedown outside the root.
 * "Independent researcher" is a controlled checkbox rendered only
 * while the author has no non-independent affiliation.
 */
import { Check } from 'lucide-react';
import { useEffect, type ReactNode, type RefObject } from 'react';
import { nameOf } from './affiliation-ops';
import type { AffiliationEntry } from './byline-model';
import type { RorOrg } from './ror-client';

/** Borderless, touch-sized input shared by the picker sheets. */
export const INPUT = 'min-h-11 w-full outline-none';

/**
 * Bottom-bordered combobox input of the affiliation picker.
 *
 * @param props - Query text, popover state and the open/query/close callbacks.
 * @returns The search input wired as an ARIA combobox.
 */
export function SearchField(props: {
  query: string; open: boolean;
  onOpen(): void; onQuery(text: string): void; onClose(): void;
}): ReactNode {
  return (
    <input data-testid="affiliation-search" aria-label="Search affiliations" value={props.query}
      placeholder="Search affiliation" className={`${INPUT} border-b border-secondary`} role="combobox"
      aria-expanded={props.open} aria-controls="affiliation-listbox"
      onFocus={props.onOpen} onChange={(event) => props.onQuery(event.target.value)}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        // While the popover is open, Escape must close only the popover;
        // otherwise let the event bubble (the enclosing dialog closes).
        if (props.open) event.stopPropagation();
        props.onClose();
      }} />
  );
}

/**
 * Independent-researcher checkbox below the combobox.
 *
 * @param props - `checked` reflects the author's `independent` ref;
 *   `onChange` reports the next checkbox state.
 * @returns A controlled checkbox row rendered only while the author
 *   has no other affiliation.
 */
export function IndependentRow(props: {
  checked: boolean; onChange(next: boolean): void;
}): ReactNode {
  return (
    <label className="flex min-h-11 items-center gap-2 rounded px-2 text-sm hover:bg-hover">
      <input type="checkbox" data-testid="affiliation-independent" checked={props.checked} className="accent-black"
        onChange={(event) => props.onChange(event.target.checked)} />
      Independent researcher
    </label>
  );
}

/**
 * Close a combobox popover when a mousedown lands outside `ref`.
 *
 * @param ref - The popover owner; mousedowns inside it are ignored.
 * @param open - Whether the popover is currently open (no listener otherwise).
 * @param onClose - Called with the first outside mousedown while open.
 */
export function useOutsideClose(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
): void {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event: MouseEvent): void => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [ref, open, onClose]);
}

// Selected-state check mark pinned to the right of an option row.
const selectedMark = (testid: string): ReactNode => (
  <Check aria-hidden data-testid={testid} className="ml-auto size-4 shrink-0" />
);

// Registry suggestion row: pick target plus edit affordance.
function RegistryRow(props: {
  entry: AffiliationEntry; index: number; usage: number; selected: boolean;
  onPick(): void; onEdit(): void;
}): ReactNode {
  return (
    <div className="flex items-center gap-1">
      <button type="button" role="option" data-testid={`affiliation-registry-item-${props.index}`}
        aria-selected={props.selected} onClick={props.onPick}
        className="flex min-h-11 flex-1 items-center gap-1 rounded px-2 text-left hover:bg-hover">
        {nameOf(props.entry)}<span className="text-muted"> used by {props.usage}</span>
        {props.selected && selectedMark(`affiliation-check-${props.index}`)}
      </button>
      <button type="button" data-testid={`affiliation-edit-${props.index}`} onClick={props.onEdit}
        className="min-h-11 rounded px-2 text-muted hover:bg-hover">Edit</button>
    </div>
  );
}

// One ROR suggestion row with city and country.
function RorRow(props: { org: RorOrg; index: number; selected: boolean; onPick(): void }): ReactNode {
  return (
    <button type="button" role="option" data-testid={`affiliation-ror-item-${props.index}`}
      aria-selected={props.selected} onClick={props.onPick}
      className="flex min-h-11 w-full items-center gap-1 rounded px-2 text-left hover:bg-hover">
      {props.org.name}
      {props.org.city ? <span className="text-muted">, {props.org.city}</span> : null}
      {props.org.country ? <span className="text-muted"> · {props.org.country}</span> : null}
      {props.selected && selectedMark(`affiliation-ror-check-${props.index}`)}
    </button>
  );
}

/** One selectable registry suggestion. */
export interface RegistrySuggestion {
  entry: AffiliationEntry;
  index: number; // position in the registry array
  usage: number; // authors referencing the entry
}

/** Props for {@link AffiliationListbox}. */
export interface AffiliationListboxProps {
  registry: RegistrySuggestion[]; // entries used in this manuscript matching the query
  ror: RorOrg[]; // debounced ROR matches for the query
  isSelected: (id: string) => boolean; // author already references this entry
  isRorSelected: (org: RorOrg) => boolean; // org maps to a referenced entry
  onPickRef: (id: string) => void; // toggle a registry entry via its ref
  onEdit: (index: number) => void; // open the edit sheet for a registry entry
  onPickOrg: (org: RorOrg) => void; // toggle a ROR organization
}

/**
 * Popover listbox of affiliation suggestions.
 *
 * @param props - See {@link AffiliationListboxProps}.
 * @returns A multi-select role="listbox" container: registry rows first,
 *   ROR rows after; selected options carry aria-selected plus a check.
 */
export function AffiliationListbox({
  registry, ror, isSelected, isRorSelected, onPickRef, onEdit, onPickOrg,
}: AffiliationListboxProps): ReactNode {
  return (
    <div role="listbox" id="affiliation-listbox" data-testid="affiliation-listbox"
      aria-label="Affiliation suggestions" aria-multiselectable="true"
      className="rounded border border-secondary">
      {registry.map(({ entry, index, usage }) => (
        <RegistryRow key={String(entry.id ?? index)} entry={entry} index={index} usage={usage}
          selected={isSelected(String(entry.id))} onPick={() => onPickRef(String(entry.id))}
          onEdit={() => onEdit(index)} />
      ))}
      {ror.map((org, index) => (
        <RorRow key={org.ror} org={org} index={index} selected={isRorSelected(org)}
          onPick={() => onPickOrg(org)} />
      ))}
    </div>
  );
}

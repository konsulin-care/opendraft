/**
 * Listbox popover and combobox controls of the affiliation picker.
 *
 * Registry suggestions used in the manuscript and ROR matches render
 * inside a role="listbox" popover; "Create manually" and "Normalize to
 * references" stay outside as footer actions. The search field is an
 * ARIA combobox that closes the popover on Escape; the picker also
 * closes it on selection and on any mousedown outside the root.
 * "Independent researcher" is a checkbox rendered only while the
 * author has zero affiliations.
 */
import { useEffect, type ReactNode, type RefObject } from 'react';
import type { AffiliationEntry } from './byline-model';
import type { RorOrg } from './ror-client';

/** Lowercase display name of a registry entry. */
export const nameOf = (entry: AffiliationEntry): string =>
  typeof entry.name === 'string' ? entry.name : String(entry.id ?? '');

/** Borderless, touch-sized input shared by the picker sheets. */
export const INPUT = 'min-h-11 w-full outline-none';

/**
 * Borderless combobox input of the affiliation picker.
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
      placeholder="Affiliation" className={INPUT} role="combobox"
      aria-expanded={props.open && props.query.trim() !== ''} aria-controls="affiliation-listbox"
      onFocus={props.onOpen} onChange={(event) => props.onQuery(event.target.value)}
      onKeyDown={(event) => { if (event.key === 'Escape') props.onClose(); }} />
  );
}

/**
 * Independent-researcher checkbox below the combobox.
 *
 * @param props - `onPick` applies the built-in independent affiliation.
 * @returns A checkbox row rendered only while the author has no affiliations.
 */
export function IndependentRow({ onPick }: { onPick(): void }): ReactNode {
  return (
    <label className="flex min-h-11 items-center gap-2 rounded px-2 text-sm hover:bg-hover">
      <input type="checkbox" data-testid="affiliation-independent"
        onChange={(event) => { if (event.target.checked) onPick(); }} />
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

// Registry suggestion row: pick target plus edit affordance.
function RegistryRow(props: {
  entry: AffiliationEntry; index: number; usage: number; onPick(): void; onEdit(): void;
}): ReactNode {
  return (
    <div className="flex items-center gap-1">
      <button type="button" role="option" data-testid={`affiliation-registry-item-${props.index}`}
        onClick={props.onPick} className="min-h-11 flex-1 rounded px-2 text-left hover:bg-hover">
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
    <button type="button" role="option" data-testid={`affiliation-ror-item-${index}`} onClick={onPick}
      className="block min-h-11 w-full rounded px-2 text-left hover:bg-hover">
      {org.name}
      {org.city ? <span className="text-muted">, {org.city}</span> : null}
      {org.country ? <span className="text-muted"> · {org.country}</span> : null}
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
  onPickRef: (id: string) => void; // reuse a registry entry via its ref
  onEdit: (index: number) => void; // open the edit sheet for a registry entry
  onPickOrg: (org: RorOrg) => void; // add a ROR organization
}

/**
 * Popover listbox of affiliation suggestions.
 *
 * @param props - See {@link AffiliationListboxProps}.
 * @returns A role="listbox" container with registry rows first, ROR rows after.
 */
export function AffiliationListbox({
  registry, ror, onPickRef, onEdit, onPickOrg,
}: AffiliationListboxProps): ReactNode {
  return (
    <div role="listbox" data-testid="affiliation-listbox" aria-label="Affiliation suggestions"
      className="rounded border border-secondary">
      {registry.map(({ entry, index, usage }) => (
        <RegistryRow key={String(entry.id ?? index)} entry={entry} index={index} usage={usage}
          onPick={() => onPickRef(String(entry.id))} onEdit={() => onEdit(index)} />
      ))}
      {ror.map((org, index) => (
        <RorRow key={org.ror} org={org} index={index} onPick={() => onPickOrg(org)} />
      ))}
    </div>
  );
}

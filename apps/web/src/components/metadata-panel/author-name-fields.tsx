/**
 * Placeholder-only name editing for person authors.
 *
 * The given/family inputs carry no visible labels — only placeholders
 * and aria-labels. The "This person has only one name" checkbox stores
 * the name as `{ literal }` together with `metadata.author-type: person`
 * and restores `{ given, family }` (family taken from the literal) when
 * unticked. Particle/suffix fields sit behind the "More name options"
 * toggle.
 */
import { useState, type ClipboardEvent, type ReactNode } from 'react';
import type { MetadataAuthor } from './use-manuscript-metadata';

/** Shared borderless, touch-sized input styling. */
export const INPUT = 'min-h-11 w-full outline-none';

/** Props for {@link AuthorNameFields}. */
export interface AuthorNameFieldsProps {
  /** Author entry being edited; its metadata bag is preserved on toggles. */
  author: MetadataAuthor;
  /** Editable string record of the author's name. */
  name: Record<string, string>;
  /** Receives the patch merged into the updated author. */
  apply: (patch: Partial<MetadataAuthor>) => void;
}

/**
 * Metadata bag of an author carrying an explicit `author-type`.
 *
 * @param author - Author whose existing metadata keys are preserved.
 * @param authorType - Explicit Quarto author type to store.
 * @returns The merged metadata record containing `author-type`.
 */
export function authorTypeMetadata(
  author: MetadataAuthor,
  authorType: 'person' | 'group',
): Record<string, unknown> {
  const bag = author.metadata;
  const base = typeof bag === 'object' && bag !== null && !Array.isArray(bag)
    ? bag as Record<string, unknown>
    : {};
  return { ...base, 'author-type': authorType };
}

// Particle/suffix fields behind the "More name options" toggle.
function MoreNameOptions({ name, setName }: {
  name: Record<string, string>; setName: (patch: Record<string, string>) => void;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const field = (key: 'particle' | 'suffix', label: string): ReactNode => (
    <label className="block text-sm">
      {label}
      <input data-testid={`author-${key}`} value={name[key] ?? ''} className={INPUT}
        onChange={(event) => { const next = { ...name, [key]: event.target.value }; if (!event.target.value) delete next[key]; setName(next); }} />
    </label>
  );
  return (
    <>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="text-sm text-muted hover:bg-hover">{open ? 'Hide name options' : 'More name options'}</button>
      {open && field('particle', 'Particle (e.g. van)')}
      {open && field('suffix', 'Suffix (e.g. Jr.)')}
    </>
  );
}

// True when the name is stored as a single literal without given/family.
const isSingleName = (name: Record<string, string>): boolean =>
  typeof name.literal === 'string' && !('given' in name) && !('family' in name);

/**
 * Placeholder-only given/family inputs, the single-name checkbox and
 * the particle/suffix options of one person author.
 *
 * @param props - See {@link AuthorNameFieldsProps}.
 * @returns The name inputs and toggles; no visible field labels.
 */
export function AuthorNameFields({ author, name, apply }: AuthorNameFieldsProps): ReactNode {
  const setName = (patch: Record<string, string>): void => apply({ name: patch });
  const single = isSingleName(name);
  const setSingle = (checked: boolean): void => {
    const metadata = authorTypeMetadata(author, 'person');
    if (checked) apply({ name: { literal: name.family ?? '' }, metadata });
    else apply({ name: { given: '', family: name.literal ?? '' }, metadata });
  };
  const onPaste = (event: ClipboardEvent<HTMLInputElement>): void => {
    const text = event.clipboardData.getData('text');
    const comma = text.indexOf(',');
    if (comma < 0) return;
    event.preventDefault();
    setName({ ...name, family: text.slice(0, comma).trim(), given: text.slice(comma + 1).trim() });
  };
  return (
    <>
      {!single && (
        <input data-testid="author-given" placeholder="Given name(s)" aria-label="Given name(s)"
          value={name.given ?? ''} className={INPUT}
          onChange={(event) => setName({ ...name, given: event.target.value })} />
      )}
      {single ? (
        <input data-testid="author-literal" placeholder="Name" aria-label="Name"
          value={name.literal ?? ''} className={INPUT}
          onChange={(event) => setName({ ...name, literal: event.target.value })} />
      ) : (
        <input data-testid="author-family" placeholder="Family name" aria-label="Family name"
          value={name.family ?? ''} className={INPUT}
          onChange={(event) => setName({ ...name, family: event.target.value })} onPaste={onPaste} />
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" data-testid="author-single-name" checked={single}
          onChange={(event) => setSingle(event.target.checked)} />
        This person has only one name
      </label>
      <MoreNameOptions name={name} setName={setName} />
    </>
  );
}

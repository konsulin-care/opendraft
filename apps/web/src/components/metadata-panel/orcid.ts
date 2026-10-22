/**
 * ORCID field: URL stripping, live hyphenation, ISO 7064 MOD 11-2
 * checksum validation, and the confirmed "Fill from ORCID" lookup of
 * given/family names from pub.orcid.org with silent network fallback.
 */
import { createElement, useEffect, useRef, useState, type ReactNode } from 'react';
import { IconField } from './author-fields';
import type { MetadataAuthor } from './use-manuscript-metadata';

/** Given and family names read from an ORCID person record. */
export interface OrcidNames {
  given: string;
  family: string;
}

/** Props for {@link OrcidField}. */
export interface OrcidFieldProps {
  author: MetadataAuthor; // author entry being edited
  onChange: (next: MetadataAuthor) => void; // receives the full updated author
  focus?: boolean; // focus the input on mount (draft authors)
}

/** Pasted orcid.org URL prefixes that normalize away. */
const URL_PREFIX = /^(?:https?:\/\/)?(?:www\.)?orcid\.org\//i;

/** Green text badge standing in for the ORCID icon lucide lacks. */
const ORCID_BADGE = 'text-sm font-bold text-green-700';

// Keep at most 16 digits plus an optional trailing checksum X.
function bareDigits(value: string): string {
  const cleaned = value.replace(URL_PREFIX, '').replace(/[^0-9xX]/g, '').toUpperCase();
  const digits = cleaned.replace(/[^0-9]/g, '').slice(0, 16);
  return cleaned.endsWith('X') ? `${digits.slice(0, 15)}X` : digits;
}

/**
 * Format raw ORCID input for display: strips a pasted orcid.org URL,
 * keeps digits plus a trailing checksum X and hyphenates every four
 * characters without a trailing hyphen.
 *
 * @param value - Raw input as typed or pasted.
 * @returns Hyphenated display value, possibly partial.
 */
export function formatOrcidInput(value: string): string {
  return bareDigits(value).replace(/(\d{4})(?=\d)/g, '$1-');
}

/**
 * Normalize an ORCID to its canonical hyphenated form, validating the
 * ISO 7064 MOD 11-2 checksum.
 *
 * @param value - Raw value, possibly a full orcid.org URL.
 * @returns The canonical 19-character ORCID, or null when the shape or
 *          checksum is invalid.
 */
export function normalizeOrcid(value: string): string | null {
  const raw = bareDigits(value);
  if (!/^\d{15}[\dX]$/.test(raw)) return null;
  let total = 0;
  for (const digit of raw.slice(0, 15)) total = (total + Number(digit)) * 2;
  const check = (12 - (total % 11)) % 11;
  if (raw[15] !== (check === 10 ? 'X' : String(check))) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}`;
}

/**
 * Fetch given/family names for an ORCID from the public person API.
 * Never throws: every failure resolves to null so the UI can fall back
 * silently.
 *
 * @param orcid - ORCID whose person record is read.
 * @param fetchFn - Fetch implementation; injectable for tests.
 * @returns The names, or null on network error, non-ok status or a
 *          malformed payload.
 */
export async function fetchOrcidNames(orcid: string, fetchFn: typeof fetch = fetch): Promise<OrcidNames | null> {
  try {
    const id = normalizeOrcid(orcid) ?? orcid;
    const response = await fetchFn(`https://pub.orcid.org/v3.0/${id}/person`, { headers: { Accept: 'application/json' } });
    if (!response.ok) return null;
    const body = await response.json() as {
      name?: { givenNames?: { value?: unknown }; familyName?: { value?: unknown } };
    };
    const given = body?.name?.givenNames?.value;
    const family = body?.name?.familyName?.value;
    if (typeof given !== 'string' || typeof family !== 'string') return null;
    return { given, family };
  } catch {
    return null;
  }
}

/**
 * Merge confirmed ORCID names into an editable name record; empty
 * parts leave the existing names untouched.
 *
 * @param name - Current name record of the author.
 * @param given - Given names from the ORCID record.
 * @param family - Family name from the ORCID record.
 * @returns A new name record with the non-empty parts replaced.
 */
export function fillOrcidNames(name: Record<string, string>, given: string, family: string): Record<string, string> {
  const next = { ...name };
  if (given.trim()) next.given = given.trim();
  if (family.trim()) next.family = family.trim();
  return next;
}

// Coerce a YAML name value into an editable string record.
function nameRecord(name: unknown): Record<string, string> {
  if (name && typeof name === 'object' && !Array.isArray(name)) {
    return Object.fromEntries(Object.entries(name).map(([key, value]) => [key, typeof value === 'string' ? value : '']));
  }
  return typeof name === 'string' ? { family: name } : { given: '', family: '' };
}

// Set the orcid of the author, deleting the key when the value is cleared.
function withOrcid(author: MetadataAuthor, id: string): MetadataAuthor {
  const next = { ...author };
  if (id) next.orcid = id;
  else delete next.orcid;
  return next;
}

// Run the confirmed Fill flow; returns silently on an invalid id, a
// failed fetch or a declined confirmation.
async function fillFromRecord(author: MetadataAuthor, text: string, onChange: (next: MetadataAuthor) => void): Promise<void> {
  const id = normalizeOrcid(text);
  if (!id) return;
  const names = await fetchOrcidNames(id);
  if (!names) return;
  if (!window.confirm(`Use ${names.given} ${names.family} from this ORCID record?`)) return;
  onChange({ ...author, name: fillOrcidNames(nameRecord(author.name), names.given, names.family) });
}

// Loose createElement cast: the typed overload rejects data-testid
// props and this file stays .ts (no JSX) to keep the field colocated.
const h = createElement as unknown as (
  type: unknown, props?: Record<string, unknown>, ...children: ReactNode[]
) => ReactNode;

/**
 * ORCID input with URL stripping, live hyphenation and checksum
 * validation. Invalid values are never written to the author; a valid
 * value enables "Fill from ORCID", which asks for confirmation before
 * replacing the given/family names and falls back silently on errors.
 *
 * @param props - See {@link OrcidFieldProps}.
 * @returns The input, an error marker for an invalid checksum and the
 *          Fill button shown only for valid values.
 */
export function OrcidField({ author, onChange, focus = false }: OrcidFieldProps): ReactNode {
  const [text, setText] = useState(() => (typeof author.orcid === 'string' ? author.orcid : ''));
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (focus) inputRef.current?.focus(); }, [focus]);
  useEffect(() => { setText(typeof author.orcid === 'string' ? author.orcid : ''); }, [author.orcid]);
  const id = normalizeOrcid(text);
  const invalid = text.trim() !== '' && id === null;
  const handle = (value: string): void => {
    const display = formatOrcidInput(value);
    setText(display);
    const next = normalizeOrcid(display);
    if (next) onChange(withOrcid(author, next));
    else if (!display) onChange(withOrcid(author, ''));
  };
  return h('div', { className: 'space-y-1' },
    h(IconField, {
      ref: inputRef, testid: 'author-orcid', ariaLabel: 'ORCID',
      icon: h('span', { className: ORCID_BADGE }, 'iD'),
      placeholder: '0000-0000-0000-0000', value: text,
      onChange: (event: { target: { value: string } }) => handle(event.target.value),
    }),
    invalid && h('span', { 'data-testid': 'author-orcid-error', role: 'alert', className: 'block text-sm text-amber-800' },
      'Invalid ORCID checksum'),
    id && h('button', {
      type: 'button', 'data-testid': 'author-orcid-fill', className: 'rounded border border-secondary bg-white px-2 py-1 text-sm hover:bg-hover',
      onClick: () => { void fillFromRecord(author, text, onChange); },
    }, 'Fill from ORCID'),
  );
}

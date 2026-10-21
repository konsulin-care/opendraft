/**
 * Group members editor of a group author card.
 *
 * Members add, edit and remove inline: a structured name, an optional
 * ORCID and an affiliation registry ref. 'Paste list' appends one
 * member per line in 'Family, Given' form; a bare line becomes a
 * family-only member.
 */
import { useState, type ReactNode } from 'react';
import type { MetadataAuthor } from './use-manuscript-metadata';

/** Props for {@link GroupMembers}. */
export interface GroupMembersProps {
  /** Member entries of the group author in file order. */
  members: MetadataAuthor[];
  /** Persist the updated member list to the group author. */
  onChange: (members: MetadataAuthor[]) => void;
}

/** Shared borderless, touch-sized input styling. */
const INPUT = 'min-h-11 w-full outline-none';
/** Touch-sized row button styling. */
const BTN = 'min-h-11 rounded px-2 hover:bg-hover';

/** Coerce a YAML member name into an editable string record. */
function asName(name: unknown): Record<string, string> {
  if (typeof name === 'string') return { family: name };
  if (name && typeof name === 'object' && !Array.isArray(name)) {
    return Object.fromEntries(
      Object.entries(name).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
  }
  return { given: '', family: '' };
}

/** Parse one 'Family, Given' line into a member entry. */
function parseMemberLine(line: string): MetadataAuthor | null {
  const text = line.trim();
  if (!text) return null;
  const comma = text.indexOf(',');
  const family = (comma < 0 ? text : text.slice(0, comma)).trim();
  const given = comma < 0 ? '' : text.slice(comma + 1).trim();
  if (!family && !given) return null;
  const name: Record<string, string> = {};
  if (given) name.given = given;
  if (family) name.family = family;
  return { name };
}

/** Parse a pasted list: one member per line in 'Family, Given' form. */
function parseMemberList(text: string): MetadataAuthor[] {
  return text
    .split(/\r?\n/)
    .map(parseMemberLine)
    .filter((member): member is MetadataAuthor => member !== null);
}

// First registry ref of a member's affiliations, '' when none.
function firstRef(member: MetadataAuthor): string {
  const affs = Array.isArray(member.affiliations) ? member.affiliations : [];
  const ref = (affs[0] as Record<string, unknown> | undefined)?.['ref'];
  return typeof ref === 'string' ? ref : '';
}

/** Apply one name patch, dropping keys that were emptied. */
function patchName(member: MetadataAuthor, patch: Record<string, string>): MetadataAuthor {
  const name = asName(member.name);
  for (const [key, value] of Object.entries(patch)) {
    if (value) name[key] = value;
    else delete name[key];
  }
  return { ...member, name };
}

/** Set or delete one string field of the member entry. */
function setStr(member: MetadataAuthor, key: string, value: string): MetadataAuthor {
  const next = { ...member };
  if (value) next[key] = value;
  else delete next[key];
  return next;
}

/** One member row: name fields, ORCID, affiliation ref and remove. */
function MemberRow({ member, index, onChange, onRemove }: {
  member: MetadataAuthor;
  index: number;
  onChange: (next: MetadataAuthor) => void;
  onRemove: () => void;
}): ReactNode {
  const name = asName(member.name);
  const field = (key: 'given' | 'family', label: string): ReactNode => (
    <label className="block flex-1 text-sm">{label}
      <input data-testid={`member-${key}-${index}`} value={name[key] ?? ''} className={INPUT}
        onChange={(event) => onChange(patchName(member, { [key]: event.target.value }))} />
    </label>
  );
  const setAff = (value: string): void => {
    if (value) {
      onChange({ ...member, affiliations: [{ ref: value }] });
      return;
    }
    const next = { ...member };
    delete next.affiliations;
    onChange(next);
  };
  return (
    <div data-testid={`group-member-${index}`} className="rounded border border-secondary p-2">
      <div className="flex items-end gap-2">
        {field('given', 'Given')}
        {field('family', 'Family')}
        <button type="button" data-testid={`member-remove-${index}`} aria-label={`Remove member ${index + 1}`}
          onClick={onRemove} className="min-h-11 rounded px-2 hover:bg-hover">×</button>
      </div>
      <div className="flex items-end gap-2">
        <label className="block flex-1 text-sm">ORCID
          <input data-testid={`member-orcid-${index}`} value={typeof member.orcid === 'string' ? member.orcid : ''} className={INPUT}
            onChange={(event) => onChange(setStr(member, 'orcid', event.target.value))} />
        </label>
        <label className="block flex-1 text-sm">Affiliation ref
          <input data-testid={`member-affiliation-${index}`} value={firstRef(member)} className={INPUT}
            onChange={(event) => setAff(event.target.value)} />
        </label>
      </div>
    </div>
  );
}

/**
 * Members editor of one group author: ordered rows with inline name,
 * ORCID and affiliation-ref editing, an add button and a 'Paste list'
 * box appending one 'Family, Given' member per line.
 *
 * @param props - See {@link GroupMembersProps}.
 * @returns The members section.
 */
export function GroupMembers({ members, onChange }: GroupMembersProps): ReactNode {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [text, setText] = useState('');
  const add = (): void => {
    const parsed = parseMemberList(text);
    if (parsed.length > 0) onChange([...members, ...parsed]);
    setText('');
    setPasteOpen(false);
  };
  return (
    <div data-testid="group-members" className="mt-2 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Members</h4>
        <div className="flex gap-1">
          <button type="button" data-testid="member-paste-list" aria-expanded={pasteOpen}
            onClick={() => setPasteOpen(!pasteOpen)} className={BTN}>Paste list</button>
          <button type="button" data-testid="member-add" onClick={() => onChange([...members, { name: { given: '', family: '' } }])}
            className={BTN}>Add member</button>
        </div>
      </div>
      {pasteOpen && (
        <div>
          <textarea data-testid="member-paste-input" aria-label="Paste members" rows={3} value={text}
            placeholder="Family, Given" className="min-h-11 w-full border border-secondary p-2 text-sm outline-none"
            onChange={(event) => setText(event.target.value)} />
          <button type="button" data-testid="member-paste-add" onClick={add} className={BTN}>Add</button>
        </div>
      )}
      {members.map((member, index) => (
        <MemberRow key={index} member={member} index={index}
          onChange={(next) => onChange(members.map((m, i) => (i === index ? next : m)))}
          onRemove={() => onChange(members.filter((_, i) => i !== index))} />
      ))}
    </div>
  );
}

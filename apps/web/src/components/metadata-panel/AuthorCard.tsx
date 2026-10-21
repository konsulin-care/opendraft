/**
 * Expanded editor card for one author of the authors dialog.
 * Person authors get name fields, single-name checkbox, particle/suffix,
 * live preview, comma-paste split, ORCID, degrees, email, status toggles,
 * on-behalf-of and CRediT pills; groups get a literal name and pills.
 */import { useEffect, useRef, useState, type ClipboardEvent, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react'; import { GroupMembers } from './GroupMembers';
import type { MetadataAuthor } from './use-manuscript-metadata';

/** Group entry offered by the "On behalf of" dropdown. */
export interface GroupOption {
  id: string; // hidden author id
  name: string; // literal group name
}
/** Props for {@link AuthorCard}. */
export interface AuthorCardProps {
  author: MetadataAuthor; // author entry being edited
  groups?: GroupOption[]; // groups usable for "On behalf of"
  focusOrcid?: boolean; // focus the ORCID field on mount (draft authors)
  onChange: (next: MetadataAuthor) => void; // receives the full updated author
}

/** Shared borderless, touch-sized input styling. */
const INPUT = 'min-h-11 w-full outline-none';
/** Pill styling shared by the type toggle and the CRediT pills. */
const pillClass = (active: boolean): string =>
  `rounded border px-2 py-1 text-sm ${active ? 'border-blue-600 bg-blue-600 text-white' : 'border-secondary bg-white hover:bg-hover'}`;

/** The 14 CRediT roles as label/tooltip pairs; slugs derive from labels. */
const CREDIT_ROLES: ReadonlyArray<readonly [string, string]> = [
  ['Conceptualization', 'Ideas or hypothesis'], ['Data curation', 'Data management'], ['Formal analysis', 'Statistics or mathematics'],
  ['Funding acquisition', 'Obtained grant funding'], ['Investigation', 'Conducting the research'], ['Methodology', 'Design of the methods'],
  ['Project administration', 'Project management'], ['Resources', 'Materials, tools, datasets'], ['Software', 'Software construction'],
  ['Supervision', 'Mentoring and oversight'], ['Validation', 'Verification of results'], ['Visualization', 'Figures and display'],
  ['Writing – original draft', 'First draft'], ['Writing – review & editing', 'Revisions and review'],
];

// Derive the CRediT slug of a role label.
const creditSlug = (label: string): string => label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Coerce a YAML name value into an editable string record.
function asName(name: unknown): Record<string, string> {
  if (name && typeof name === 'object' && !Array.isArray(name)) {
    return Object.fromEntries(Object.entries(name).map(([key, value]) => [key, typeof value === 'string' ? value : '']));
  }
  return typeof name === 'string' ? { family: name } : { given: '', family: '' };
}

// Display name: literal for groups, otherwise given/particle/family/suffix.
const displayName = (name: Record<string, string>): string => name.literal
  || [name.given, name.particle, name.family, name.suffix].filter(Boolean).join(' ');

// Live preview parts: the byline name and the short-citation form.
function citationOf(name: Record<string, string>): { byline: string; citation: string } {
  const family = name.family || name.literal || '';
  const given = (name.given ?? '').trim().split(/\s+/).filter(Boolean);
  const initials = given.length > 0 ? `${given.map((w) => w.charAt(0).toUpperCase()).join('. ')}.`
    : `${family.charAt(0).toUpperCase()}.`;
  return { byline: displayName(name), citation: `${family}, ${initials}` };
}

// Non-empty strings of a YAML array value.
const strList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);

// Set or delete one string field of the author.
function setStr(author: MetadataAuthor, key: string, value: string): MetadataAuthor {
  const next = { ...author };
  if (value) next[key] = value;
  else delete next[key];
  return next;
}
/** Shared editing context handed to the card bodies. */
interface CardEdit {
  author: MetadataAuthor; name: Record<string, string>;
  groups: GroupOption[]; focusOrcid: boolean;
  apply: (patch: Partial<MetadataAuthor>) => void;
}

/** Person/Group author-type toggle. */
function TypeToggle({ group, onSet }: { group: boolean; onSet: (group: boolean) => void }): ReactNode {
  return (
    <div className="flex gap-1" role="group" aria-label="Author type">
      <button type="button" data-testid="author-type-person" aria-pressed={!group} onClick={() => onSet(false)} className={pillClass(!group)}>Person</button>
      <button type="button" data-testid="author-type-group" aria-pressed={group} onClick={() => onSet(true)} className={pillClass(group)}>Group</button>
    </div>
  );
}

// Particle/suffix fields behind the "More name options" toggle.
function MoreNameOptions({ name, setName }: { name: Record<string, string>; setName: (patch: Record<string, string>) => void }): ReactNode {
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
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="text-sm text-muted hover:bg-hover">More name options</button>
      {open && field('particle', 'Particle (e.g. van)')}
      {open && field('suffix', 'Suffix (e.g. Jr.)')}
    </>
  );
}

// Given/family fields, the single-name checkbox and comma-paste split.
function NameFields({ name, setName }: { name: Record<string, string>; setName: (patch: Record<string, string>) => void }): ReactNode {
  const single = !('given' in name);
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
        <label className="block text-sm">Given name(s)
          <input data-testid="author-given" value={name.given ?? ''} className={INPUT}
            onChange={(event) => setName({ ...name, given: event.target.value })} />
        </label>
      )}
      <label className="block text-sm">Family name
        <input data-testid="author-family" value={name.family ?? ''} className={INPUT}
          onChange={(event) => setName({ ...name, family: event.target.value })} onPaste={onPaste} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" data-testid="author-single-name" checked={single}
          onChange={(event) => setName(event.target.checked ? { family: name.family ?? '' } : { ...name, given: '' })} />
        This person has only one name
      </label>
      <MoreNameOptions name={name} setName={setName} />
    </>
  );
}

// Degrees chips with an add field.
function Degrees({ degrees, onSet }: { degrees: string[]; onSet: (degrees: string[]) => void }): ReactNode {
  const [text, setText] = useState('');
  const add = (): void => {
    const value = text.trim();
    if (value && !degrees.includes(value)) onSet([...degrees, value]);
    setText('');
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {degrees.map((degree, index) => (
          <span key={degree} data-testid="author-degree-chip" className="rounded bg-surface-low px-2 py-0.5 text-sm">
            {degree}
            <button type="button" data-testid={`author-degree-remove-${index}`} aria-label={`Remove ${degree}`}
              onClick={() => onSet(degrees.filter((d) => d !== degree))}>×</button>
          </span>
        ))}
      </div>
      <input data-testid="author-degree-field" aria-label="Degree" value={text} placeholder="Add degree" className={INPUT}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} />
    </div>
  );
}

// Corresponding / equal contributor / deceased status toggles.
function StatusToggles({ author, apply }: { author: MetadataAuthor; apply: CardEdit['apply'] }): ReactNode {
  const box = (key: string, label: string): ReactNode => (
    <label key={key} className="flex items-center gap-2 text-sm">
      <input type="checkbox" data-testid={`author-${key}`} checked={author[key] === true}
        onChange={(event) => apply({ [key]: event.target.checked })} />
      {label}
    </label>
  );
  return <div>{box('corresponding', 'Corresponding author')}{box('equal-contributor', 'Equal contributor')}{box('deceased', 'Deceased')}</div>;
}

// "On behalf of" dropdown listing the group authors.
function OnBehalf({ value, groups, onChange }: { value: string; groups: GroupOption[]; onChange: (id: string) => void }): ReactNode {
  if (groups.length === 0) return null;
  return (
    <label className="block text-sm">
      On behalf of
      <select data-testid="author-on-behalf-of" value={value} className="min-h-11 w-full" onChange={(event) => onChange(event.target.value)}>
        <option value="">None</option>
        {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
      </select>
    </label>
  );
}

// The 14 CRediT toggle pills with definitions as tooltips.
function CreditPills({ roles, onToggle }: { roles: string[]; onToggle: (slug: string) => void }): ReactNode {
  return (
    <div className="flex flex-wrap gap-1">
      {CREDIT_ROLES.map(([label, def]) => {
        const slug = creditSlug(label);
        return (
          <button key={slug} type="button" data-testid={`credit-${slug}`} title={def} aria-pressed={roles.includes(slug)}
            onClick={() => onToggle(slug)} className={pillClass(roles.includes(slug))}>{label}</button>
        );
      })}
    </div>
  );
}

// Collapsible "More" section: url, phone, fax, note, acknowledgements.
function MoreFields({ author, onChange }: { author: MetadataAuthor; onChange: (next: MetadataAuthor) => void }): ReactNode {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="text-sm text-muted hover:bg-hover">More</button>
      {open && ['url', 'phone', 'fax', 'note', 'acknowledgements'].map((key) => (
        <input key={key} data-testid={`author-${key}`} aria-label={key} className={INPUT}
          value={typeof author[key] === 'string' ? author[key] : ''} onChange={(event) => onChange(setStr(author, key, event.target.value))} />
      ))}
    </>
  );
}
// Email input shared by the person and group bodies.
function EmailField({ author, apply }: { author: MetadataAuthor; apply: CardEdit['apply'] }): ReactNode {
  return (
    <input data-testid="author-email" aria-label="Email" className={INPUT} value={typeof author.email === 'string' ? author.email : ''}
      onChange={(event) => apply(setStr(author, 'email', event.target.value))} />
  );
}

// Person-author body of the card.
function PersonBody({ edit }: { edit: CardEdit }): ReactNode {
  const { author, name, groups, focusOrcid, apply } = edit;
  const roles = strList(author.roles);
  const toggleRole = (slug: string): void =>
    apply({ roles: roles.includes(slug) ? roles.filter((r) => r !== slug) : [...roles, slug] });
  const orcidRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (focusOrcid) orcidRef.current?.focus(); }, [focusOrcid]);
  return (
    <>
      <NameFields name={name} setName={(patch) => apply({ name: patch })} />
      <div data-testid="author-preview" className="text-sm text-muted">
        Byline: {citationOf(name).byline} · Citation: {citationOf(name).citation}
      </div>
      <input ref={orcidRef} data-testid="author-orcid" aria-label="ORCID" placeholder="0000-0000-0000-0000" className={INPUT}
        value={typeof author.orcid === 'string' ? author.orcid : ''}
        onChange={(event) => apply(setStr(author, 'orcid', event.target.value))} />
      <EmailField author={author} apply={apply} />
      <Degrees degrees={strList(author.degrees)} onSet={(degrees) => apply({ degrees })} />
      <StatusToggles author={author} apply={apply} />
      <OnBehalf value={typeof author['on-behalf-of'] === 'string' ? author['on-behalf-of'] : ''} groups={groups}
        onChange={(id) => apply(setStr(author, 'on-behalf-of', id))} />
      <CreditPills roles={roles} onToggle={toggleRole} />
      <MoreFields author={author} onChange={apply} />
    </>
  );
}

// Group-author body of the card.
function GroupBody({ edit }: { edit: CardEdit }): ReactNode {
  const { author, name, apply } = edit;
  const roles = strList(author.roles);
  return (
    <>
      <label className="block text-sm">Group name
        <input data-testid="author-group-name" value={name.literal ?? ''} className={INPUT}
          onChange={(event) => apply({ name: { literal: event.target.value } })} />
      </label>
      <EmailField author={author} apply={apply} />
      <GroupMembers members={Array.isArray(author.members) ? author.members : []} onChange={(members) => apply({ members })} />
      <CreditPills roles={roles} onToggle={(slug) => apply({ roles: roles.includes(slug) ? roles.filter((r) => r !== slug) : [...roles, slug] })} />
    </>
  );
}

/**
 * Expanded editor card for one author.
 *
 * @param props - See {@link AuthorCardProps}.
 * @returns The type toggle, warning marker and the person or group body.
 */
export function AuthorCard({ author, groups = [], focusOrcid = false, onChange }: AuthorCardProps): ReactNode {
  const name = asName(author.name);
  const group = typeof name.literal === 'string';
  const apply = (patch: Partial<MetadataAuthor>): void => onChange({ ...author, ...patch });
  const setType = (toGroup: boolean): void => {
    if (toGroup === group) return;
    apply({ name: toGroup ? { literal: displayName(name) } : { family: name.literal ?? '' } });
  };
  return (
    <div className="space-y-2 px-2 pb-3">
      <TypeToggle group={group} onSet={setType} />
      {!group && !(Array.isArray(author.affiliations) && author.affiliations.length > 0) && (
        <span data-testid="author-warning" className="text-amber-800">
          <AlertTriangle aria-hidden className="inline size-4" /> No affiliation
        </span>
      )}
      {group ? <GroupBody edit={{ author, name, groups, focusOrcid, apply }} />
        : <PersonBody edit={{ author, name, groups, focusOrcid, apply }} />}
    </div>
  );
}

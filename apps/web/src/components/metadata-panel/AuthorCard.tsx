/**
 * Expanded editor card for one author of the authors dialog.
 * Person authors get placeholder-only name fields, the single-name
 * checkbox storing `{ literal }` with `metadata.author-type: person`,
 * particle/suffix, comma-paste split, status toggles, ORCID, degrees,
 * email, an `affiliation` ReactNode slot rendered in its own section
 * right after the name section, CRediT pills and the "Show author
 * details" fields; groups get a literal name and pills. The person form
 * wraps its content in `space-y-2` section wrappers (Name, Affiliation,
 * Status, Contact & identifiers, Contributions) inside a `space-y-4`
 * card, so the sections are spaced more widely than their inner rows.
 * Sections render in that order. The Person/Group toggle writes
 * `metadata.author-type`.
 */import { type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react'; import { GroupMembers } from './GroupMembers'; import { OrcidField } from './orcid';
import { Degrees, EmailField, MoreFields, setStr } from './author-fields';
import { isGroupAuthor } from '@opendraft/schema';
import { AuthorNameFields, authorTypeMetadata, INPUT } from './author-name-fields';
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
  affiliation?: ReactNode; // affiliation slot rendered after the name section
  focusOrcid?: boolean; // focus the ORCID field on mount (draft authors)
  onChange: (next: MetadataAuthor) => void; // receives the full updated author
}

/** Pill styling shared by the type toggle and the CRediT pills. */
const pillClass = (active: boolean): string =>
  `rounded border px-2 py-1 text-sm ${active ? 'border-black bg-black text-white' : 'border-secondary bg-white hover:bg-hover'}`;

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

// Non-empty strings of a YAML array value.
const strList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []);

/** Shared editing context handed to the card bodies. */
interface CardEdit {
  author: MetadataAuthor; name: Record<string, string>;
  groups: GroupOption[]; focusOrcid: boolean; affiliation: ReactNode;
  apply: (patch: Partial<MetadataAuthor>) => void;
  onChange: (next: MetadataAuthor) => void;
  setType: (toGroup: boolean) => void;
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

// Corresponding / equal contributor / deceased status toggles.
function StatusToggles({ author, apply }: { author: MetadataAuthor; apply: CardEdit['apply'] }): ReactNode {
  const box = (key: string, label: string): ReactNode => (
    <label key={key} className="flex items-center gap-2 text-sm">
      <input type="checkbox" data-testid={`author-${key}`} checked={author[key] === true} className="accent-black"
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

// Person-author body: Name, Affiliation slot, Status (corresponding,
// equal contributor, deceased, on-behalf-of), Contact & identifiers
// (ORCID, email, degrees), Contributions, Show author details.
function PersonBody({ edit }: { edit: CardEdit }): ReactNode {
  const { author, name, groups, affiliation, focusOrcid, apply, onChange, setType } = edit;
  const roles = strList(author.roles);
  const toggleRole = (slug: string): void =>
    apply({ roles: roles.includes(slug) ? roles.filter((r) => r !== slug) : [...roles, slug] });
  const noAffiliation = !(Array.isArray(author.affiliations) && author.affiliations.length > 0);
  return (
    <>
      <section className="space-y-2">
        <TypeToggle group={false} onSet={setType} />
        <AuthorNameFields author={author} name={name} apply={apply} />
        {noAffiliation && (
          <span data-testid="author-warning" className="text-amber-800">
            <AlertTriangle aria-hidden className="inline size-4" /> No affiliation
          </span>
        )}
      </section>
      {affiliation && <section className="space-y-2">{affiliation}</section>}
      <section className="space-y-2">
        <StatusToggles author={author} apply={apply} />
        <OnBehalf value={typeof author['on-behalf-of'] === 'string' ? author['on-behalf-of'] : ''} groups={groups}
          onChange={(id) => apply(setStr(author, 'on-behalf-of', id))} />
      </section>
      <section className="space-y-2">
        <OrcidField author={author} onChange={onChange} focus={focusOrcid} />
        <EmailField author={author} apply={apply} />
        <Degrees degrees={strList(author.degrees)} onSet={(degrees) => apply({ degrees })} />
      </section>
      <section className="space-y-2">
        <CreditPills roles={roles} onToggle={toggleRole} />
        <MoreFields author={author} onChange={apply} />
      </section>
    </>
  );
}

// Group-author body of the card.
function GroupBody({ edit }: { edit: CardEdit }): ReactNode {
  const { author, name, apply, setType } = edit;
  const roles = strList(author.roles);
  return (
    <section className="space-y-2">
      <TypeToggle group onSet={setType} />
      <label className="block text-sm">Group name
        <input data-testid="author-group-name" value={name.literal ?? ''} className={INPUT}
          onChange={(event) => apply({ name: { literal: event.target.value } })} />
      </label>
      <EmailField author={author} apply={apply} />
      <GroupMembers members={Array.isArray(author.members) ? author.members : []} onChange={(members) => apply({ members })} />
      <CreditPills roles={roles} onToggle={(slug) => apply({ roles: roles.includes(slug) ? roles.filter((r) => r !== slug) : [...roles, slug] })} />
    </section>
  );
}

/**
 * Expanded editor card for one author.
 *
 * @param props - See {@link AuthorCardProps}.
 * @returns The person or group body: five `space-y-2` sections in a
 * `space-y-4` card for persons, one section for groups.
 */
export function AuthorCard({ author, groups = [], affiliation, focusOrcid = false, onChange }: AuthorCardProps): ReactNode {
  const name = asName(author.name);
  const group = isGroupAuthor(author);
  const apply = (patch: Partial<MetadataAuthor>): void => onChange({ ...author, ...patch });
  const setType = (toGroup: boolean): void => {
    if (toGroup === group) return;
    apply({
      name: toGroup ? { literal: displayName(name) } : { family: name.literal ?? '' },
      metadata: authorTypeMetadata(author, toGroup ? 'group' : 'person'),
    });
  };
  const edit: CardEdit = { author, name, groups, affiliation, focusOrcid, apply, onChange, setType };
  return (
    <div className="space-y-4 px-2 pb-3">
      {group ? <GroupBody edit={edit} /> : <PersonBody edit={edit} />}
    </div>
  );
}

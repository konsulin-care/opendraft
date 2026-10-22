/**
 * Byline model for the article view.
 *
 * Derives per-author byline segments (affiliation superscripts numbered
 * by first appearance, symbol flags, ORCID, on-behalf-of phrasing), the
 * numbered affiliation list, footnotes limited to symbols in use, the
 * collaborator groups and the CRediT contribution statement with derived
 * initials.
 */
import type { MetadataAuthor } from './use-manuscript-metadata';

/** Affiliation registry entry from _author.yml. */
export interface AffiliationEntry {
  id?: string;
  name?: string;
  [key: string]: unknown;
}

/** One resolved affiliation, numbered by first appearance. */
export interface BylineAffiliation {
  id: string;
  number: number;
  name: string;
}

/** One author's byline segment. */
export interface BylineAuthor {
  key: string;
  name: string;
  superscript: string;
  corresponding: boolean;
  equal: boolean;
  deceased: boolean;
  orcid?: string;
  email?: string;
  roles: string[];
  onBehalfOf?: string;
  group: boolean;
  members: string[];
}

/** A group author rendered in the collaborators list. */
export interface CollaboratorGroup {
  key: string;
  name: string;
  count: number;
  members: string[];
}

/** Complete byline model of one manuscript. */
export interface BylineModel {
  authors: BylineAuthor[];
  affiliations: BylineAffiliation[];
  footnotes: string[];
  collaborators: CollaboratorGroup[];
  contributions: string[];
  hasContributions: boolean;
}

/** The 14 NISO CRediT roles as slug/label pairs in canonical order. */
const CREDIT_ROLES: ReadonlyArray<readonly [string, string]> = [
  ['conceptualization', 'Conceptualization'],
  ['data-curation', 'Data curation'],
  ['formal-analysis', 'Formal analysis'],
  ['funding-acquisition', 'Funding acquisition'],
  ['investigation', 'Investigation'],
  ['methodology', 'Methodology'],
  ['project-administration', 'Project administration'],
  ['resources', 'Resources'],
  ['software', 'Software'],
  ['supervision', 'Supervision'],
  ['validation', 'Validation'],
  ['visualization', 'Visualization'],
  ['writing-original-draft', 'Writing – original draft'],
  ['writing-review-editing', 'Writing – review & editing'],
];

/** Coerce a parsed YAML value to a plain record. */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/** Structured name parts of an author; empty strings when absent. */
function nameParts(name: unknown): { given: string; family: string } {
  if (typeof name === 'string') return { given: '', family: name };
  const record = asRecord(name);
  if (typeof record.literal === 'string') return { given: '', family: record.literal };
  return {
    given: typeof record.given === 'string' ? record.given : '',
    family: typeof record.family === 'string' ? record.family : '',
  };
}

/**
 * Derive an author's display name: literal for groups, otherwise given
 * names then family name (with optional particle and suffix).
 *
 * @param author - Author entry from _author.yml.
 * @returns The display name, or '' when no name is present.
 */
export function authorDisplayName(author: MetadataAuthor): string {
  const name = author.name;
  if (typeof name === 'string') return name;
  const record = asRecord(name);
  if (typeof record.literal === 'string') return record.literal;
  return [record.given, record.particle, record.family, record.suffix]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ');
}

/**
 * Derive dotted initials from given names and a family name.
 *
 * @param given - Given name(s), space separated; may be empty.
 * @param family - Family name.
 * @returns Initials such as `A.M.S.`, or `D.` for a family name only.
 */
export function initials(given: string, family: string): string {
  const letters = [
    ...given.trim().split(/\s+/).filter(Boolean).map((word) => word.charAt(0).toUpperCase()),
    family.trim().charAt(0).toUpperCase(),
  ].filter(Boolean);
  return `${letters.join('.')}.`;
}

/** CRediT contribution lines with derived initials, in canonical order. */
function buildContributions(authors: MetadataAuthor[]): string[] {
  const lines: string[] = [];
  for (const [slug, label] of CREDIT_ROLES) {
    const names = authors
      .filter((author) => Array.isArray(author.roles) && author.roles.includes(slug))
      .map((author) => {
        const parts = nameParts(author.name);
        const literal = asRecord(author.name).literal;
        return typeof literal === 'string'
          ? literal
          : initials(parts.given, parts.family || parts.given);
      });
    if (names.length > 0) lines.push(`${label}: ${names.join(', ')}`);
  }
  return lines;
}

/** Dedupe-and-number state for affiliations, in first-appearance order. */
interface AffiliationNumbering {
  order: BylineAffiliation[];
  numbered: (key: string, label: string, id?: string) => string;
}

/** Create the affiliation numbering state shared across all authors. */
function createNumbering(): AffiliationNumbering {
  const order: BylineAffiliation[] = [];
  const seen = new Map<string, number>();
  return {
    order,
    numbered: (key: string, label: string, id = key): string => {
      let number = seen.get(key);
      if (number === undefined) {
        number = order.length + 1;
        seen.set(key, number);
        order.push({ id, number, name: label });
      }
      return String(number);
    },
  };
}

/** Map of group author id to its literal group name. */
function collectGroupNames(authors: MetadataAuthor[]): Map<string, string> {
  const groupNames = new Map<string, string>();
  for (const author of authors) {
    const literal = asRecord(author.name).literal;
    if (typeof author.id === 'string' && typeof literal === 'string') {
      groupNames.set(author.id, literal);
    }
  }
  return groupNames;
}

/** Shared inputs of the per-author entry builder. */
interface BuildContext {
  registry: Map<string, AffiliationEntry>;
  numbering: AffiliationNumbering;
  groupNames: Map<string, string>;
}

/** Create the shared builder inputs for one author list. */
function createContext(
  authors: MetadataAuthor[],
  affiliations: AffiliationEntry[],
): BuildContext {
  const registry = new Map(
    affiliations
      .filter((entry) => typeof entry.id === 'string')
      .map((entry) => [entry.id as string, entry]),
  );
  return { registry, numbering: createNumbering(), groupNames: collectGroupNames(authors) };
}

/** Resolve one author's affiliation superscript numbers. */
function affiliationNumbers(author: MetadataAuthor, ctx: BuildContext): string {
  return (Array.isArray(author.affiliations) ? author.affiliations : [])
    .map((entry) => {
      const record = asRecord(entry);
      if (typeof record.ref === 'string') {
        const target = ctx.registry.get(record.ref);
        return ctx.numbering.numbered(`ref:${record.ref}`, target?.name ?? record.ref, record.ref);
      }
      if (typeof record.name === 'string') {
        return ctx.numbering.numbered(`inline:${record.name}`, record.name);
      }
      return null;
    })
    .filter((value): value is string => value !== null)
    .join(',');
}

/** Build the byline segment of one author. */
function buildEntry(
  author: MetadataAuthor,
  index: number,
  ctx: BuildContext,
): BylineAuthor {
  const behalf = author['on-behalf-of'];
  const members = (Array.isArray(author.members) ? author.members : [])
    .map((member) => authorDisplayName({ name: asRecord(member).name }))
    .filter(Boolean);
  const roles = Array.isArray(author.roles) ? author.roles.filter(
    (role): role is string => typeof role === 'string',
  ) : [];
  return {
    key: typeof author.id === 'string' ? author.id : `author-${index}`,
    name: authorDisplayName(author),
    superscript: affiliationNumbers(author, ctx),
    corresponding: author.corresponding === true,
    equal: author['equal-contributor'] === true,
    deceased: author.deceased === true,
    orcid: typeof author.orcid === 'string' ? author.orcid : undefined,
    email: typeof author.email === 'string' ? author.email : undefined,
    roles,
    onBehalfOf: typeof behalf === 'string' && ctx.groupNames.has(behalf)
      ? `on behalf of ${ctx.groupNames.get(behalf)}`
      : undefined,
    group: typeof asRecord(author.name).literal === 'string',
    members,
  };
}

/** Footnote lines: symbols in use only; affiliations live in the list. */
function buildFootnotes(entries: BylineAuthor[]): string[] {
  return [
    ...(entries.some((entry) => entry.corresponding) ? ['* Corresponding author'] : []),
    ...(entries.some((entry) => entry.equal) ? ['† Equal contribution'] : []),
    ...(entries.some((entry) => entry.deceased) ? ['‡ Deceased'] : []),
  ];
}

/**
 * Build the complete byline model for a manuscript's authors.
 *
 * Affiliation superscripts are numbered by first appearance in author
 * order; footnotes contain only the symbol lines (`*`, `†`, `‡`) actually
 * in use — numbered affiliations render once via {@link BylineModel.affiliations}.
 *
 * @param authors - Author entries of _author.yml in file order.
 * @param affiliations - Affiliation registry entries (id + name).
 * @returns See {@link BylineModel}.
 */
export function buildByline(
  authors: MetadataAuthor[],
  affiliations: AffiliationEntry[] = [],
): BylineModel {
  const ctx = createContext(authors, affiliations);
  const entries = authors.map(
    (author, index) => buildEntry(author, index, ctx),
  );
  return {
    authors: entries,
    affiliations: ctx.numbering.order,
    footnotes: buildFootnotes(entries),
    collaborators: entries
      .filter((entry) => entry.group && entry.members.length > 0)
      .map((entry) => ({
        key: entry.key,
        name: entry.name,
        count: entry.members.length,
        members: entry.members,
      })),
    contributions: buildContributions(authors),
    hasContributions: authors.some(
      (author) => Array.isArray(author.roles) && author.roles.length > 0,
    ),
  };
}

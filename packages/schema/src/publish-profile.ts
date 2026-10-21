import { checkAuthorIntegrity } from './author-integrity.js';
import { resolvePublishIdentity } from './publish-identity.js';

/** Severity of a publish profile issue. */
export type PublishIssueLevel = 'commit' | 'publish' | 'warning';

/** A single publish readiness issue: severity, dotted field path and message. */
export interface PublishIssue {
  level: PublishIssueLevel;
  /** Dotted field path, e.g. 'authors.1.affiliations' or 'license'. */
  path: string;
  message: string;
}

/** Metadata documents that can fail to parse as YAML. */
export type PublishFileKey = 'frontmatter' | 'author' | 'abstract' | 'opendraft';

/** Inputs to the publish readiness profile: parsed documents plus publish context. */
export interface PublishReadinessInput {
  /** Parsed _frontmatter.yml content. */
  frontmatter?: unknown;
  /** Parsed _author.yml content. */
  author?: unknown;
  /** Parsed _abstract.yml content. */
  abstract?: unknown;
  /** Parsed opendraft.yml content (registered repository, manuscripts). */
  opendraft?: unknown;
  /** Id of the manuscript being checked, to locate its opendraft.yml entry. */
  manuscriptId?: string | null;
  /** Repository URL the publish would run from; skips the fork rule when absent. */
  currentRepositoryUrl?: string | null;
  /** YAML parse error detail per file; checks for a failed file are skipped. */
  parseErrors?: Partial<Record<PublishFileKey, string>>;
}

const ORCID_PATTERN = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROR_ID_PATTERN = /^[0-9a-z]{9}$/i;
const FILE_KEYS: readonly PublishFileKey[] = ['frontmatter', 'author', 'abstract', 'opendraft'];

/** Build one issue entry. */
function issue(level: PublishIssueLevel, path: string, message: string): PublishIssue {
  return { level, path, message };
}

/** Type guard for plain objects (YAML mappings parsed to records). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Trimmed string value, or the empty string for non-strings. */
function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Append a nullable issue to its bucket. */
function pushIssue(target: PublishIssue[], candidate: PublishIssue | null): void {
  if (candidate) target.push(candidate);
}

/** True when the author name is not a literal (group/consortium) name. */
function isPerson(author: unknown): boolean {
  if (!isRecord(author)) return false;
  return !(isRecord(author.name) && typeof author.name.literal === 'string');
}

/**
 * Validate a ROR identifier: bare id or https://ror.org/<id> URL.
 *
 * @param value - Raw value from an affiliation's `ror` field.
 * @returns True when the value has ROR id format.
 */
function isValidRor(value: string): boolean {
  const id = value
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/^ror\.org\//, '')
    .replace(/\/+$/, '');
  return ROR_ID_PATTERN.test(id);
}

/** Commit issue for a present value that fails its format pattern, or null. */
function formatIssue(
  value: unknown,
  path: string,
  pattern: RegExp,
  label: string,
): PublishIssue | null {
  const raw = text(value);
  if (raw && !pattern.test(raw)) return issue('commit', path, `invalid ${label}: '${raw}'`);
  return null;
}

/** Commit issue for a present ROR value that fails ROR id format, or null. */
function rorIssue(value: unknown, path: string): PublishIssue | null {
  const raw = text(value);
  if (raw && !isValidRor(raw)) return issue('commit', path, `invalid ROR id: '${raw}'`);
  return null;
}

/** Commit issues for a top-level affiliations registry (ROR format only). */
function registryFormatIssues(affiliations: unknown): PublishIssue[] {
  if (!Array.isArray(affiliations)) return [];
  const issues: PublishIssue[] = [];
  affiliations.forEach((entry, index) => {
    if (isRecord(entry)) pushIssue(issues, rorIssue(entry.ror, `affiliations.${index}.ror`));
  });
  return issues;
}

/** Commit issues for one author: ORCID, email, inline ROR, member ORCIDs. */
function authorFormatIssues(author: unknown, index: number): PublishIssue[] {
  if (!isRecord(author)) return [];
  const issues: PublishIssue[] = [];
  pushIssue(issues, formatIssue(author.orcid, `authors.${index}.orcid`, ORCID_PATTERN, 'ORCID format'));
  pushIssue(issues, formatIssue(author.email, `authors.${index}.email`, EMAIL_PATTERN, 'email'));
  const refs = Array.isArray(author.affiliations) ? author.affiliations : [];
  refs.forEach((entry, refIndex) => {
    if (isRecord(entry)) {
      pushIssue(issues, rorIssue(entry.ror, `authors.${index}.affiliations.${refIndex}.ror`));
    }
  });
  const members = Array.isArray(author.members) ? author.members : [];
  members.forEach((member, memberIndex) => {
    if (isRecord(member)) {
      pushIssue(
        issues,
        formatIssue(member.orcid, `authors.${index}.members.${memberIndex}.orcid`, ORCID_PATTERN, 'ORCID format'),
      );
    }
  });
  return issues;
}

/** Commit issues from YAML parse failures, one per failed file. */
function parseIssues(parseErrors: Partial<Record<PublishFileKey, string>>): PublishIssue[] {
  const issues: PublishIssue[] = [];
  for (const key of FILE_KEYS) {
    const detail = parseErrors[key];
    if (detail === undefined) continue;
    issues.push(issue('commit', key, detail ? `YAML parse error: ${detail}` : `YAML parse error in ${key}`));
  }
  return issues;
}

/** Issues for missing title (commit), license and abstract (warnings), skipping failed files. */
function documentIssues(
  frontmatter: unknown,
  abstract: unknown,
  errors: Partial<Record<PublishFileKey, string>>,
): PublishIssue[] {
  const issues: PublishIssue[] = [];
  if (!errors.frontmatter) {
    if (!isRecord(frontmatter) || !text(frontmatter.title)) {
      issues.push(issue('commit', 'title', 'missing title'));
    }
    if (!isRecord(frontmatter) || !text(frontmatter.license)) {
      issues.push(issue('warning', 'license', 'missing license'));
    }
  }
  if (!errors.abstract && (!isRecord(abstract) || !text(abstract.abstract))) {
    issues.push(issue('warning', 'abstract', 'missing abstract'));
  }
  return issues;
}

/** Publish issues derived from the authors list itself. */
function authorPublishIssues(author: unknown): PublishIssue[] {
  const data = isRecord(author) ? author : null;
  const source = data && Array.isArray(data.authors) ? data.authors : data?.author;
  const authors = Array.isArray(source) ? source : [];
  if (authors.length === 0) return [issue('publish', 'authors', 'no authors')];

  const issues: PublishIssue[] = [];
  authors.forEach((entry, index) => {
    if (isPerson(entry) && !(isRecord(entry) && Array.isArray(entry.affiliations) && entry.affiliations.length)) {
      issues.push(issue('publish', `authors.${index}.affiliations`, 'person author has no affiliation'));
    }
  });

  let flaggedNoEmail = -1;
  let hasEmail = false;
  authors.forEach((entry, index) => {
    if (!isRecord(entry) || !isPerson(entry) || entry.corresponding !== true) return;
    if (text(entry.email)) hasEmail = true;
    else if (flaggedNoEmail < 0) flaggedNoEmail = index;
  });
  if (!hasEmail) {
    const path = flaggedNoEmail >= 0 ? `authors.${flaggedNoEmail}.email` : 'authors';
    issues.push(issue('publish', path, 'no corresponding person with email'));
  }
  return issues;
}

/** Locate the manuscript entry in opendraft.yml; single-entry configs default to index 0. */
function locateManuscript(
  manuscripts: unknown[],
  manuscriptId: string | null | undefined,
): { index: number; entry: Record<string, unknown> | null } {
  let index = -1;
  if (typeof manuscriptId === 'string' && manuscriptId) {
    index = manuscripts.findIndex((m) => isRecord(m) && m.id === manuscriptId);
  } else if (manuscripts.length === 1) {
    index = 0;
  }
  const found = index >= 0 ? manuscripts[index] : undefined;
  const entry = isRecord(found) ? found : null;
  return { index, entry };
}

/** Issues from the fork rule: mismatch is publish-blocking, integrity commit. */
function identityIssues(input: PublishReadinessInput): PublishIssue[] {
  const current = text(input.currentRepositoryUrl);
  if (!current) return [];
  const config = isRecord(input.opendraft) ? input.opendraft : null;
  const manuscripts = config && Array.isArray(config.manuscripts) ? config.manuscripts : [];
  const { index, entry } = locateManuscript(manuscripts, input.manuscriptId);
  const result = resolvePublishIdentity({
    repository: config ? text(config.repository) : undefined,
    currentRepositoryUrl: current,
    conceptDoi: entry ? text(entry['concept-doi']) : undefined,
    conceptDoiRepository: entry ? text(entry['concept-doi-repository']) : undefined,
  });
  if (result.kind === 'repository-mismatch') {
    return [
      issue('publish', 'repository', 'repository mismatch: current repository is not the registered repository'),
    ];
  }
  if (result.kind === 'integrity-error') {
    const path = index >= 0 ? `manuscripts.${index}.concept-doi-repository` : 'repository';
    return [issue('commit', path, 'concept DOI is bound to a different repository')];
  }
  return [];
}

/**
 * Check publish readiness of a manuscript's metadata documents.
 *
 * Classifies issues per the publish profile table: commit-blocking (YAML parse
 * errors, missing title, broken refs, duplicate ids, invalid ORCID/email/ROR
 * format, integrity errors), publish-blocking (no authors, person author
 * without affiliation, no corresponding person with email, repository
 * mismatch) and warnings (missing license, missing abstract). Missing
 * keywords, roles, funding, subject or ORCID are never reported; groups and
 * their members are exempt from the affiliation rule. Issues are ordered
 * commit, then publish, then warning, each with a dotted field path.
 *
 * @param input - Parsed metadata documents, opendraft.yml and publish context.
 * @returns Issues ordered by level; empty when ready to commit and publish.
 */
export function checkPublishReadiness(input: PublishReadinessInput): PublishIssue[] {
  const parseErrors = input.parseErrors ?? {};
  const commit: PublishIssue[] = [];
  const publish: PublishIssue[] = [];
  const warning: PublishIssue[] = [];

  commit.push(...parseIssues(parseErrors));

  for (const found of documentIssues(input.frontmatter, input.abstract, parseErrors)) {
    (found.level === 'commit' ? commit : warning).push(found);
  }
  if (!parseErrors.author) {
    const data = isRecord(input.author) ? input.author : null;
    if (data) {
      commit.push(...checkAuthorIntegrity(data).map((e) => issue('commit', e.path, e.message)));
      commit.push(...registryFormatIssues(data.affiliations));
      const authors = Array.isArray(data.authors) ? data.authors : [];
      authors.forEach((author, index) => commit.push(...authorFormatIssues(author, index)));
    }
    publish.push(...authorPublishIssues(input.author));
  }
  if (!parseErrors.opendraft) {
    identityIssues(input).forEach((found) => {
      (found.level === 'commit' ? commit : publish).push(found);
    });
  }

  return [...commit, ...publish, ...warning];
}

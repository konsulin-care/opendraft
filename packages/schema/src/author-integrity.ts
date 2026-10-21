import type { ValidationError } from './types.js';

/** Shared lookup state for one integrity pass. */
interface IntegrityContext {
  /** Ids present in the top-level affiliations registry. */
  registryIds: Set<string>;
  /** Authors indexed by their id, for on-behalf-of target lookup. */
  authorsById: Map<string, Record<string, unknown>>;
}

/**
 * Type guard for plain objects (YAML mappings parsed to records).
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Extract the registry ref from an affiliations list item.
 *
 * @param item - An affiliations list entry ({ref} or inline object).
 * @returns The ref string, or null when the entry carries no ref.
 */
function refOf(item: unknown): string | null {
  return isRecord(item) && typeof item.ref === 'string' ? item.ref : null;
}

/** True when the author name is a literal (group/consortium) name. */
function isLiteralName(name: unknown): boolean {
  return isRecord(name) && typeof name.literal === 'string';
}

/**
 * Collect the ids of the top-level affiliations registry.
 *
 * @param affiliations - The top-level affiliations array, if present.
 * @returns Set of registry id strings.
 */
function collectRegistryIds(affiliations: unknown): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(affiliations)) return ids;
  for (const entry of affiliations) {
    if (isRecord(entry) && typeof entry.id === 'string') ids.add(entry.id);
  }
  return ids;
}

/**
 * Index authors by their id for on-behalf-of target lookup.
 *
 * @param authors - Parsed authors array.
 * @returns Map of author id to author record.
 */
function indexAuthorsById(authors: unknown[]): Map<string, Record<string, unknown>> {
  const byId = new Map<string, Record<string, unknown>>();
  for (const author of authors) {
    if (isRecord(author) && typeof author.id === 'string') byId.set(author.id, author);
  }
  return byId;
}

/** Report duplicate ids in the affiliations registry (one error per repeat). */
function checkRegistryIds(affiliations: unknown, errors: ValidationError[]): void {
  if (!Array.isArray(affiliations)) return;
  const seen = new Set<string>();
  affiliations.forEach((entry, index) => {
    if (!isRecord(entry) || typeof entry.id !== 'string') return;
    if (seen.has(entry.id)) {
      errors.push({
        path: `affiliations.${index}.id`,
        message: `duplicate registry id '${entry.id}'`,
      });
      return;
    }
    seen.add(entry.id);
  });
}

/** Report duplicate author ids (one error per repeat). */
function checkAuthorIds(authors: unknown[], errors: ValidationError[]): void {
  const seen = new Set<string>();
  authors.forEach((author, index) => {
    if (!isRecord(author) || typeof author.id !== 'string') return;
    if (seen.has(author.id)) {
      errors.push({
        path: `authors.${index}.id`,
        message: `duplicate author id '${author.id}'`,
      });
      return;
    }
    seen.add(author.id);
  });
}

/** Report unresolved registry refs in an affiliations list under a path prefix. */
function checkRefs(
  affiliations: unknown,
  pathPrefix: string,
  registryIds: Set<string>,
  errors: ValidationError[],
): void {
  if (!Array.isArray(affiliations)) return;
  affiliations.forEach((item, refIndex) => {
    const ref = refOf(item);
    if (ref !== null && !registryIds.has(ref)) {
      errors.push({
        path: `${pathPrefix}.${refIndex}.ref`,
        message: `affiliation ref '${ref}' unresolved`,
      });
    }
  });
}

/** Report unresolved registry refs among a group author's members. */
function checkMembers(
  members: unknown,
  authorIndex: number,
  registryIds: Set<string>,
  errors: ValidationError[],
): void {
  if (!Array.isArray(members)) return;
  members.forEach((member, memberIndex) => {
    if (!isRecord(member) || !Array.isArray(member.affiliations)) return;
    checkRefs(
      member.affiliations,
      `authors.${authorIndex}.members.${memberIndex}.affiliations`,
      registryIds,
      errors,
    );
  });
}

/** Report on-behalf-of defects: unknown target or non-group target. */
function checkBehalfOf(
  author: Record<string, unknown>,
  index: number,
  authorsById: Map<string, Record<string, unknown>>,
  errors: ValidationError[],
): void {
  const behalf = author['on-behalf-of'];
  if (typeof behalf !== 'string') return;
  const target = authorsById.get(behalf);
  if (!target) {
    errors.push({
      path: `authors.${index}.on-behalf-of`,
      message: `on-behalf-of target '${behalf}' not found`,
    });
    return;
  }
  if (!isLiteralName(target.name)) {
    errors.push({
      path: `authors.${index}.on-behalf-of`,
      message: `on-behalf-of '${behalf}' points to a person author; target must be a group author`,
    });
  }
}

/** Run all per-author checks: affiliation refs, on-behalf-of, member refs. */
function checkAuthor(
  author: Record<string, unknown>,
  index: number,
  ctx: IntegrityContext,
  errors: ValidationError[],
): void {
  checkRefs(author.affiliations, `authors.${index}.affiliations`, ctx.registryIds, errors);
  checkBehalfOf(author, index, ctx.authorsById, errors);
  checkMembers(author.members, index, ctx.registryIds, errors);
}

/**
 * Check referential integrity of an _author.yml document.
 *
 * Verifies that every affiliation ref (author and member) resolves to the
 * top-level affiliations registry, that author ids and registry ids are
 * unique, and that each `on-behalf-of` targets an existing group author
 * (a name with a literal/consortium form).
 *
 * @param data - Parsed _author.yml content.
 * @returns One ValidationError with a dotted path per defect; empty when valid.
 */
export function checkAuthorIntegrity(data: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!isRecord(data)) return errors;

  const registryIds = collectRegistryIds(data.affiliations);
  checkRegistryIds(data.affiliations, errors);
  if (!Array.isArray(data.authors)) return errors;

  checkAuthorIds(data.authors, errors);
  const ctx: IntegrityContext = {
    registryIds,
    authorsById: indexAuthorsById(data.authors),
  };
  data.authors.forEach((author, index) => {
    if (isRecord(author)) checkAuthor(author, index, ctx, errors);
  });
  return errors;
}

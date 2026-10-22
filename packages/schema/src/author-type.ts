/**
 * Explicit author type resolution: person vs. group authors.
 *
 * Quarto normalizes unknown author keys under `metadata`, so authors may
 * carry `metadata: { author-type: 'person' | 'group' }` in `_author.yml`.
 * When the explicit type is absent, a legacy heuristic applies: a name that
 * is an object with `literal` and no `given`/`family` is treated as a group.
 */

/** Shape of the Quarto-safe author metadata bag we care about. */
interface AuthorTypeMetadata {
  'author-type'?: unknown;
}

/** Shape of an author record we care about. */
interface AuthorLike {
  metadata?: unknown;
  name?: unknown;
}

/** Narrow an unknown value to a plain record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** True when the name is an object with a string `literal` and no given/family. */
function isLegacyLiteralName(name: unknown): boolean {
  if (!isRecord(name)) return false;
  if (typeof name.literal !== 'string') return false;
  return name.given === undefined && name.family === undefined;
}

/**
 * Determine whether an author represents a group (consortium, institution,
 * working group) rather than a person.
 *
 * An explicit `metadata.author-type` (`'person'` or `'group'`) always wins.
 * When it is absent, the legacy heuristic applies: a name that is an object
 * with `literal` and no `given`/`family` is a group; everything else is a
 * person.
 *
 * @param author - The author record; non-objects are not groups.
 * @returns True when the author should be treated as a group author.
 */
export function isGroupAuthor(author: unknown): boolean {
  if (!isRecord(author)) return false;

  const metadata = (author as AuthorLike).metadata;
  if (isRecord(metadata)) {
    const authorType = (metadata as AuthorTypeMetadata)['author-type'];
    if (authorType === 'group') return true;
    if (authorType === 'person') return false;
  }

  return isLegacyLiteralName((author as AuthorLike).name);
}

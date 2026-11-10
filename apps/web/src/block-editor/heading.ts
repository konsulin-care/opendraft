/**
 * Canonical heading line utilities for block files.
 *
 * A block file opens with a heading
 * `# Title {#sec-<short> .deo-<role>}` (role class optional: custom
 * sections carry no class) followed by the section body.
 * `splitHeading` parses that first line into title, anchor and role and
 * returns the remaining body verbatim; a file without such a leading
 * heading comes back body-only with null heading parts. `joinHeading`
 * reassembles heading and body into canonical file text, exactly
 * inverting `splitHeading`.
 */

/** Parts of a canonical heading, used when rejoining a block file. */
export interface BlockHeading {
  /** Heading text between `# ` and the attribute block. */
  title: string;
  /** Anchor id including the `sec-` prefix, e.g. `sec-methods`. */
  anchor: string;
  /** Role without the `deo-` prefix, e.g. `methods`; omit for no class. */
  type?: string | null;
}

/** A block file split into heading parts and the remaining body. */
export interface SplitHeading {
  /** Heading title, or `null` when the file has no canonical leading heading. */
  title: string | null;
  /** Anchor id including the `sec-` prefix, or `null` without a heading. */
  anchor: string | null;
  /** Role without the `deo-` prefix; `null` for a heading with no class
   *  or a file with no heading. */
  type: string | null;
  /** Text after the heading line; the whole file when there is no heading. */
  body: string;
}

/** Matches `# <title> {#sec-<short> [ .<class>]}` on a single line. */
const HEADING_PATTERN = /^# (.+) \{#(sec-[a-z0-9-]+)(?: \.(doco-[a-z0-9-]+|deo-[a-z0-9-]+))?\}$/;

/** Prefix of a `.deo-<type>` role class token. */
const TYPE_PREFIX = 'deo-';

/** Generic section type and its canonical `.doco-section` class. */
const GENERIC_TYPE = 'section';
const GENERIC_CLASS = 'doco-section';

/**
 * Map a heading class token to its section type.
 *
 * @param className - Class without the leading dot, e.g. `deo-methods`;
 *                    `undefined` when the heading carries no class.
 * @returns The generic `'section'` for `.doco-section` and the legacy
 *          `.deo-section`, the role for `.deo-<role>`, or `null` for a
 *          class-less heading.
 */
function classToType(className: string | undefined): string | null {
  if (className === undefined) return null;
  if (className === GENERIC_CLASS || className === `${TYPE_PREFIX}${GENERIC_TYPE}`) {
    return GENERIC_TYPE;
  }
  return className.slice(TYPE_PREFIX.length);
}

/**
 * Split a block file at its canonical leading heading.
 *
 * Only the first line is considered, so H2 and deeper headings anywhere in
 * the body stay untouched. A file whose first line is not a canonical
 * heading is returned entirely as `body` with all heading parts null.
 * Rejoining the result reproduces the input exactly.
 *
 * @param text - Full block file text.
 * @returns Heading parts plus the remaining body; the whole file as
 *          `body` (and null parts) when there is no leading heading.
 */
export function splitHeading(text: string): SplitHeading {
  const lineEnd = text.indexOf('\n');
  const firstLine = (lineEnd === -1 ? text : text.slice(0, lineEnd)).replace(/\r$/, '');
  const match = HEADING_PATTERN.exec(firstLine);
  if (match === null) {
    return { title: null, anchor: null, type: null, body: text };
  }
  const [, title, anchor, className] = match;
  const body = lineEnd === -1 ? '' : text.slice(lineEnd + 1);
  return { title, anchor, type: classToType(className), body };
}

/**
 * Join heading parts and a body into canonical block file text.
 *
 * The heading becomes the file's first line —
 * `# <title> {#<anchor> .doco-section}` for the generic `'section'`
 * type, `# <title> {#<anchor> .deo-<role>}` for a role, and no class
 * when the role is absent or null — followed by the body verbatim, the
 * exact inverse of `splitHeading`.
 *
 * @param heading - Heading parts (use literals when the file had no
 *                  leading heading of its own).
 * @param body - Section body, typically the `body` from `splitHeading`.
 * @returns Canonical block file text.
 */
export function joinHeading(heading: BlockHeading, body: string): string {
  let role = '';
  if (heading.type) {
    const className = heading.type === GENERIC_TYPE ? GENERIC_CLASS : `${TYPE_PREFIX}${heading.type}`;
    role = ` .${className}`;
  }
  return `# ${heading.title} {#${heading.anchor}${role}}\n${body}`;
}

/**
 * Heading rules for included block files: heading presence, level-1
 * placement, heading classes against SECTION_ROLES, and the shared
 * duplicate-anchor detection used by validateAssembly. Pure helpers —
 * no I/O — kept here so assembly.ts stays under the 300-line limit.
 */

import type { ValidationError } from './types.js';
import { SECTION_ROLES } from './naming.js';

/** Matches a level-1 Markdown heading line (after trimming). */
const LEVEL_ONE_RE = /^#\s/;

/** Matches the trailing attribute block of a heading, e.g. `{#sec-intro .deo-intro}`. */
const ATTRIBUTES_RE = /\{([^}]*)\}\s*$/;

/** Matches a `.class` token inside a heading attribute block. */
const CLASS_TOKEN_RE = /^\.[A-Za-z0-9_-]+$/;

/** Generic section class allowed on any block heading. */
const GENERIC_CLASS = 'doco-section';

/** Prefix of a `.deo-<role>` role class token. */
const ROLE_PREFIX = 'deo-';

/** Heading analysis result for a single block file. */
export interface BlockHeadingFindings {
  /** Blocking violations (unknown heading classes). */
  errors: ValidationError[];
  /** Non-blocking findings (missing heading, level-1 heading in body). */
  warnings: ValidationError[];
  /** The block heading's anchor label, or null when absent. */
  anchor: string | null;
}

/**
 * Test a heading class against the allowed set: `.doco-section` or
 * `.deo-<role>` with the role drawn from SECTION_ROLES.
 *
 * @param className - Class token without the leading dot.
 * @returns True when the class is allowed on a block heading.
 */
function isAllowedClass(className: string): boolean {
  if (className === GENERIC_CLASS) return true;
  const role = className.startsWith(ROLE_PREFIX)
    ? className.slice(ROLE_PREFIX.length)
    : null;
  return role !== null && SECTION_ROLES.includes(role);
}

/**
 * Parse a heading line's attribute block into its anchor and classes.
 *
 * @param line - Trimmed heading line.
 * @returns The anchor label (null when absent) and class tokens.
 */
function parseHeadingAttributes(line: string): { anchor: string | null; classes: string[] } {
  const attributes = ATTRIBUTES_RE.exec(line);
  if (attributes === null) return { anchor: null, classes: [] };
  let anchor: string | null = null;
  const classes: string[] = [];
  for (const token of attributes[1].split(/\s+/)) {
    if (token === '') continue;
    if (token.startsWith('#') && anchor === null) {
      anchor = token.slice(1);
    } else if (token.startsWith('.') && CLASS_TOKEN_RE.test(token)) {
      classes.push(token.slice(1));
    }
  }
  return { anchor, classes };
}

/**
 * Apply the heading rules to one included block's content.
 *
 * Errors: the block heading carries a class that is neither
 * `.doco-section` nor `.deo-<role>` with role in SECTION_ROLES.
 * Warnings: the block has no level-1 heading at all, or a level-1
 * heading appears after the first line (a stray H1 in the body).
 * The anchor comes from the first level-1 heading line.
 *
 * @param path - Block path (`blocks/_<short>.qmd`) used in findings.
 * @param content - Block file content.
 * @returns Errors, warnings and the heading anchor (null when absent).
 */
export function analyzeBlockHeading(path: string, content: string): BlockHeadingFindings {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const lines = content.split('\n');
  let first: { line: string; index: number } | null = null;
  const headingIndexes: number[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (!LEVEL_ONE_RE.test(trimmed)) continue;
    headingIndexes.push(index);
    if (first === null) first = { line: trimmed, index };
  }

  if (first === null) {
    warnings.push({ path, message: `missing heading in ${path}` });
    return { errors, warnings, anchor: null };
  }

  const { anchor, classes } = parseHeadingAttributes(first.line);
  for (const className of classes) {
    if (!isAllowedClass(className)) {
      errors.push({
        path,
        message: `unknown heading class .${className} in ${path} (allowed: .doco-section or .deo-<role> section role)`,
      });
    }
  }
  for (const index of headingIndexes) {
    if (index > 0) {
      warnings.push({ path, message: `level-1 heading in body of ${path}` });
    }
  }
  return { errors, warnings, anchor };
}

/**
 * Record a block's anchor for duplicate detection.
 *
 * @param seen - Anchors already seen, mapped to the first block path.
 * @param anchor - Anchor label of the current block.
 * @param path - Current block path.
 * @returns One error naming both paths when the anchor was already
 *          seen, otherwise null (the anchor is recorded).
 */
export function duplicateAnchorError(
  seen: Map<string, string>,
  anchor: string,
  path: string,
): ValidationError | null {
  const previous = seen.get(anchor);
  if (previous !== undefined) {
    return {
      path: 'assembly',
      message: `duplicate anchor ${anchor}: ${previous} and ${path}`,
    };
  }
  seen.set(anchor, path);
  return null;
}

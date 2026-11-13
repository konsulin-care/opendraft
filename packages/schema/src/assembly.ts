import type { ValidationError, ValidationResult } from './types.js';
import {
  BLOCK_INCLUDE_RE,
  SHORT_NAME_PATTERN,
  blockFileName,
  parseBlockFileName,
  sectionAnchor,
} from './naming.js';
import { analyzeBlockHeading, duplicateAnchorError } from './assembly-headings.js';

/** Matches the start of a Quarto include shortcode line. */
const INCLUDE_LIKE_RE = /^\{\{< include\b/;

/** Matches a whitespace-collapsed include line, capturing its target path. */
const INCLUDE_PATH_RE = /^\{\{< include ([^\s]+) >\}\}$/;

/**
 * Result of an assembly-level validation, with warnings distinct from
 * errors so draft (orphan) blocks do not block a commit.
 */
export interface AssemblyResult extends ValidationResult {
  /** Non-blocking findings (e.g. orphan drafts). */
  warnings: ValidationError[];
}

export interface AssemblyInput {
  /** Authored assembly markdown (article.qmd). */
  assembly: string;
  /** Read block file contents keyed by `blocks/_<short>.qmd`. */
  blockFiles: Record<string, string>;
  /** Block file basenames present in the blocks directory. */
  files: string[];
}

/**
 * Collapse whitespace runs so an include line can be tested against
 * naming's BLOCK_INCLUDE_RE (which expects single spaces).
 *
 * @param line - Trimmed source line.
 * @returns The line with every whitespace run reduced to one space.
 */
function canonicalLine(line: string): string {
  return line.replace(/\s+/g, ' ');
}

/**
 * Extract `blocks/_<short>.qmd` paths from include shortcodes, in order.
 *
 * Only include lines whose whitespace-collapsed form matches naming's
 * BLOCK_INCLUDE_RE are collected; legacy or malformed includes are
 * reported by {@link validateAssembly}.
 *
 * @param assembly - Assembly markdown text.
 * @returns Prefixed block paths in include order.
 */
export function collectIncludes(assembly: string): string[] {
  const includes: string[] = [];
  for (const line of assembly.split('\n')) {
    const trimmed = line.trim();
    if (!INCLUDE_LIKE_RE.test(trimmed)) continue;
    const match = BLOCK_INCLUDE_RE.exec(canonicalLine(trimmed));
    if (match !== null) includes.push(`blocks/${blockFileName(match[1])}`);
  }
  return includes;
}


/**
 * Hint appended to an invalid include that points at a legacy
 * (un-prefixed) block file name.
 *
 * @param canonical - Whitespace-collapsed include line.
 * @returns `; run 'opendraft block normalize' ...` or an empty string.
 */
function normalizeHint(canonical: string): string {
  const match = INCLUDE_PATH_RE.exec(canonical);
  if (match === null) return '';
  const stem = match[1].replace(/^blocks\//, '').replace(/\.qmd$/, '');
  const isLegacy = match[1] === `blocks/${stem}.qmd` && SHORT_NAME_PATTERN.test(stem);
  return isLegacy ? `; run 'opendraft block normalize' to prefix legacy block files` : '';
}

/**
 * Collect errors for include lines that do not match naming's
 * BLOCK_INCLUDE_RE; legacy un-prefixed paths get a normalize hint.
 *
 * @param assembly - Assembly markdown text.
 * @returns One error per invalid include line.
 */
function invalidIncludeErrors(assembly: string): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const line of assembly.split('\n')) {
    const trimmed = line.trim();
    if (!INCLUDE_LIKE_RE.test(trimmed)) continue;
    const canonical = canonicalLine(trimmed);
    if (BLOCK_INCLUDE_RE.test(canonical)) continue;
    errors.push({ path: 'assembly', message: `invalid include path: ${trimmed}${normalizeHint(canonical)}` });
  }
  return errors;
}

/** Errors and warnings derived from the blocks directory listing. */
interface FileFindings {
  /** Blocking naming errors (legacy or invalid file names). */
  errors: ValidationError[];
  /** Non-blocking orphan (draft) warnings. */
  warnings: ValidationError[];
}

/**
 * Collect naming errors for block file basenames and orphan warnings
 * for valid files the assembly does not include.
 *
 * @param files - Block file basenames present in the blocks directory.
 * @param seen - Include paths already collected from the assembly.
 * @returns Errors and warnings derived from the listing.
 */
function fileFindings(files: string[], seen: Set<string>): FileFindings {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  for (const file of files) {
    if (!file.endsWith('.qmd')) continue;
    if (parseBlockFileName(file) === null) {
      errors.push({
        path: 'blocks',
        message: file.startsWith('_')
          ? `invalid block file name: ${file} (short name must match ${SHORT_NAME_PATTERN})`
          : `legacy block file name: ${file}; run 'opendraft block normalize' to rename it to _${file}`,
      });
      continue;
    }
    if (!seen.has(`blocks/${file}`)) {
      warnings.push({ path: 'blocks', message: `orphan block file (draft): ${file}` });
    }
  }
  return { errors, warnings };
}

/**
 * Validate file<->include consistency of an authored assembly:
 * every include must match BLOCK_INCLUDE_RE (prefixed `blocks/_<short>.qmd`),
 * every include has a matching block file (empty blocks are allowed),
 * no includes are duplicated, included blocks whose heading carries an
 * anchor use `sec-<short>` (the stem without `_`), legacy un-prefixed
 * files are errors naming `opendraft block normalize`, stems failing
 * SHORT_NAME_PATTERN are errors, and unreferenced files are reported as
 * warnings (they are legitimate drafts). Heading rules: a heading class
 * that is neither `.doco-section` nor `.deo-<role>` from SECTION_ROLES
 * is an error, two included blocks sharing an anchor are an error
 * (reported once), a block without a heading and a level-1 heading in
 * the body after the first line are warnings.
 *
 * @param input - Assembly text, block contents and directory listing.
 * @returns Validation result with separate warnings.
 */
export function validateAssembly({ assembly, blockFiles, files }: AssemblyInput): AssemblyResult {
  const errors: ValidationError[] = invalidIncludeErrors(assembly);
  const warnings: ValidationError[] = [];
  const includes = collectIncludes(assembly);
  const seen = new Set<string>();
  const anchorSeen = new Map<string, string>();

  for (const path of includes) {
    const repeated = seen.has(path);
    if (repeated) {
      errors.push({ path: 'assembly', message: `duplicate include: ${path}` });
    }
    seen.add(path);

    const content = blockFiles[path];
    if (content === undefined) {
      errors.push({ path: 'assembly', message: `missing block file: ${path}` });
      continue;
    }
    if (repeated) continue;

    const heading = analyzeBlockHeading(path, content);
    errors.push(...heading.errors);
    warnings.push(...heading.warnings);

    const short = parseBlockFileName(path)
      ?? path.replace(/^blocks\//, '').replace(/\.qmd$/, '').replace(/^_/, '');
    const expectedAnchor = sectionAnchor(short);
    if (heading.anchor !== null) {
      if (heading.anchor !== expectedAnchor) {
        errors.push({ path, message: `heading anchor mismatch in ${path}: expected ${expectedAnchor}, found ${heading.anchor}` });
      }
      const duplicate = duplicateAnchorError(anchorSeen, heading.anchor, path);
      if (duplicate !== null) errors.push(duplicate);
    }
  }

  const findings = fileFindings(files, seen);
  errors.push(...findings.errors);
  warnings.push(...findings.warnings);

  return { valid: errors.length === 0, errors, warnings };
}

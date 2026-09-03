import type { ValidationError, ValidationResult } from './types.js';

/** Matches a Quarto include shortcode line: `{{< include blocks/name.qmd >}}`. */
const INCLUDE_RE = /^\{\{< include\s+(blocks\/[a-z0-9][a-z0-9-]*\.qmd)\s*>\}\}$/;

/** Slug pattern for block file stems. */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

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
  /** Read block file contents keyed by `blocks/<slug>.qmd`. */
  blockFiles: Record<string, string>;
  /** Block file basenames present in the blocks directory. */
  files: string[];
}

/** Extract `blocks/<slug>.qmd` paths from include shortcodes, in order. */
export function collectIncludes(assembly: string): string[] {
  const includes: string[] = [];
  for (const line of assembly.split('\n')) {
    const match = INCLUDE_RE.exec(line.trim());
    if (match) includes.push(match[1]);
  }
  return includes;
}

/**
 * Validate file<->include consistency of an authored assembly:
 * every include has a non-empty block file, no includes are duplicated,
 * include paths stay under blocks/, and unreferenced files are reported
 * as warnings (they are legitimate drafts).
 *
 * @param input - Assembly text, block contents and directory listing.
 * @returns Validation result with separate warnings.
 */
export function validateAssembly({ assembly, blockFiles, files }: AssemblyInput): AssemblyResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const includes = collectIncludes(assembly);
  const seen = new Set<string>();

  for (const line of assembly.split('\n')) {
    const trimmed = line.trim();
    if (/^\{\{< include\b/.test(trimmed) && !INCLUDE_RE.test(trimmed)) {
      errors.push({ path: 'assembly', message: `invalid include path: ${trimmed}` });
    }
  }

  for (const path of includes) {
    if (seen.has(path)) {
      errors.push({ path: 'assembly', message: `duplicate include: ${path}` });
    }
    seen.add(path);

    const content = blockFiles[path];
    if (content === undefined) {
      errors.push({ path: 'assembly', message: `missing block file: ${path}` });
    } else if (content.trim() === '') {
      errors.push({ path: 'assembly', message: `empty block file: ${path}` });
    }
  }

  const stem = (file: string): string => file.replace(/\.qmd$/, '');
  for (const file of files) {
    if (!file.endsWith('.qmd')) continue;
    if (!SLUG_RE.test(stem(file))) {
      errors.push({ path: 'blocks', message: `invalid slug in file name: ${file}` });
      continue;
    }
    if (!seen.has(`blocks/${file}`)) {
      warnings.push({ path: 'blocks', message: `orphan block file (draft): ${file}` });
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
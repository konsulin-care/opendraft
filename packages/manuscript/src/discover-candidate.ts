/**
 * Read-only classification of an existing manuscript folder.
 *
 * `classifyCandidate` inspects a directory under `manuscripts/` and
 * decides whether the init flow can register it as-is (`valid`), can
 * register it after creating missing metadata starter files
 * (`repairable`), or must refuse it (`rejected`). The check never writes
 * to the workspace.
 */
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { parse } from 'yaml';
import { extractIncludes } from './blocks.js';
import { isValidManuscriptId, normalizeManuscriptId } from './manuscript-id.js';

/** Registration status of a discovered manuscript folder. */
export type CandidateStatus = 'valid' | 'repairable' | 'rejected';

/** Block layout of a discovered manuscript folder. */
export type CandidateLayout = 'block' | 'legacy';

/** Why a candidate folder cannot be registered. */
export type RejectReason = 'missing-article' | 'invalid-id' | 'missing-include';

/** Non-blocking deviation of a registrable candidate. */
export type CandidateWarning = 'bibliography-mismatch' | 'metadata-files-mismatch';

/** Result of classifying one folder under `manuscripts/`. */
export interface ManuscriptCandidate {
  /** Folder name, used as the manuscript id when registration succeeds. */
  id: string;
  /** Folder path relative to the workspace root. */
  path: string;
  /** Whether the folder is registrable as-is, after repair, or not at all. */
  status: CandidateStatus;
  /** Block layout inferred from `blocks/`. */
  layout: CandidateLayout;
  /** Metadata starter files that must be created for a repairable folder. */
  missingFiles: string[];
  /** Non-blocking front-matter deviations; user files are never edited. */
  warnings: CandidateWarning[];
  /** Rejection reason; absent for registrable folders. */
  reason?: RejectReason;
  /** Human-readable detail for a rejection. */
  detail?: string;
  /** Normalized id suggestion for an invalid folder name; never a rename. */
  suggestedId?: string;
}

/** Metadata starter files every manuscript directory must carry. */
const METADATA_FILES = ['_author.yml', '_abstract.yml', '_frontmatter.yml'] as const;

/** Expected bibliography value in a manuscript's `article.qmd` front matter. */
const EXPECTED_BIBLIOGRAPHY = '../references.bib';

/**
 * Strip a trailing slash from a directory path.
 *
 * @param dir - Directory path, possibly ending with `/`.
 * @returns The path without trailing slashes.
 */
function trimDir(dir: string): string {
  return dir.replace(/\/+$/, '');
}

/**
 * Extract the folder name from a manuscript directory path.
 *
 * @param dir - Manuscript directory path.
 * @returns The last path segment.
 */
function baseName(dir: string): string {
  const trimmed = trimDir(dir);
  return trimmed.slice(trimmed.lastIndexOf('/') + 1);
}

/**
 * Parse the YAML front matter of an article container.
 *
 * @param article - Full `article.qmd` text.
 * @returns Parsed front matter object, or an empty object when absent or
 *          not a YAML mapping.
 */
function parseFrontmatter(article: string): Record<string, unknown> {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(article);
  if (match === null) return {};
  try {
    const parsed: unknown = parse(match[1]);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Determine the block layout from a listing of the `blocks/` directory.
 *
 * @param files - File names directly under `blocks/`.
 * @returns `'block'` when a prefixed `_<short>.qmd` file exists.
 */
function detectLayout(files: string[]): CandidateLayout {
  const hasPrefixed = files.some((file) => file.startsWith('_') && file.endsWith('.qmd'));
  return hasPrefixed ? 'block' : 'legacy';
}

/**
 * Collect non-blocking front-matter warnings for an article container.
 *
 * @param article - Full `article.qmd` text.
 * @returns Warnings for a wrong bibliography path or incomplete metadata list.
 */
function collectWarnings(article: string): CandidateWarning[] {
  const frontmatter = parseFrontmatter(article);
  const warnings: CandidateWarning[] = [];

  if (frontmatter.bibliography !== EXPECTED_BIBLIOGRAPHY) {
    warnings.push('bibliography-mismatch');
  }

  const metadataFiles = frontmatter['metadata-files'];
  const listed = Array.isArray(metadataFiles) ? metadataFiles.map(String) : [];
  if (!METADATA_FILES.every((file) => listed.includes(file))) {
    warnings.push('metadata-files-mismatch');
  }

  return warnings;
}

/**
 * Find the first include shortcode whose block file is absent.
 *
 * @param files - File names directly under `blocks/`.
 * @param includes - Block short names extracted from `article.qmd`.
 * @returns The missing include target, or null when every include resolves.
 */
function findMissingInclude(files: string[], includes: string[]): string | null {
  for (const short of includes) {
    const prefixed = `_${short}.qmd`;
    const legacy = `${short}.qmd`;
    if (!files.includes(prefixed) && !files.includes(legacy)) {
      return `blocks/${prefixed}`;
    }
  }
  return null;
}

/**
 * Classify one folder under `manuscripts/` for the init flow.
 *
 * Rejection precedence is missing `article.qmd`, invalid folder name, then
 * an include shortcode pointing at a non-existent block file. A folder with
 * all rejections passed is `repairable` when metadata starter files are
 * missing and `valid` otherwise. The function only reads the workspace.
 *
 * @param ws - Workspace holding the project.
 * @param dir - Manuscript directory, e.g. `manuscripts/case-series-review`.
 * @returns The candidate classification.
 */
export async function classifyCandidate(
  ws: WorkspaceAdapter,
  dir: string,
): Promise<ManuscriptCandidate> {
  const path = trimDir(dir);
  const id = baseName(path);
  const article = await ws.readFile(`${path}/article.qmd`);
  const blockFiles = await ws.listFiles(`${path}/blocks`);
  const layout = detectLayout(blockFiles);

  const present = await Promise.all(
    METADATA_FILES.map(async (file) => (await ws.readFile(`${path}/${file}`)) !== null),
  );
  const missingFiles = METADATA_FILES.filter((_, index) => !present[index]);

  const base = { id, path, layout, missingFiles, warnings: [] as CandidateWarning[] };

  if (article === null) {
    return { ...base, status: 'rejected', reason: 'missing-article', detail: 'article.qmd not found' };
  }

  if (!isValidManuscriptId(id)) {
    return {
      ...base,
      status: 'rejected',
      reason: 'invalid-id',
      detail: `Invalid manuscript id "${id}"`,
      suggestedId: normalizeManuscriptId(id),
    };
  }

  const missingInclude = findMissingInclude(blockFiles, extractIncludes(article));
  if (missingInclude !== null) {
    return {
      ...base,
      status: 'rejected',
      reason: 'missing-include',
      detail: `Missing include target ${missingInclude}`,
    };
  }

  const warnings = collectWarnings(article);
  return {
    ...base,
    status: missingFiles.length > 0 ? 'repairable' : 'valid',
    warnings,
  };
}

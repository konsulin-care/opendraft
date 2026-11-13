/**
 * Legacy block-file normalization.
 *
 * Migrates a manuscript's `blocks/` directory from the legacy
 * un-prefixed `<short>.qmd` form to the canonical `_<short>.qmd` form
 * and rewrites the matching legacy include lines in `article.qmd` to
 * {@link includeLine}. File contents are copied byte-for-byte, so
 * heading anchors (`{#sec-<short>}`) and `@sec-<short>` references stay
 * untouched. When both file forms exist for one short name the block is
 * left alone and reported as a conflict instead of overwritten.
 */
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { includeLine, legacyBlockShort } from '@opendraft/schema';

/** Result of {@link normalizeBlockFiles}. */
export interface NormalizeBlockFilesResult {
  /** One entry per renamed file: repo-relative source and target paths. */
  renamed: Array<{ from: string; to: string }>;
  /** Short names present in both file forms, left unchanged. */
  conflicts: string[];
}

/** Matches a legacy (un-prefixed) include line, capturing the short name. */
const LEGACY_INCLUDE_RE =
  /\{\{< include blocks\/([a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?)\.qmd >\}\}/g;

/**
 * Rename legacy block files to the canonical prefixed form.
 *
 * Every `blocks/<short>.qmd` without a `blocks/_<short>.qmd` counterpart
 * is copied to the prefixed name and the legacy file is deleted; legacy
 * include lines in `article.qmd` are rewritten to the canonical
 * {@link includeLine} for those shorts. Shorts that already exist in
 * both forms are skipped and reported in `conflicts`, with neither file
 * nor include line modified. Anchors and `@sec-` references are never
 * touched.
 *
 * @param ws - Workspace holding the manuscript.
 * @param dir - Manuscript directory, e.g. `manuscripts/demo`.
 * @returns Renamed file paths and conflicted short names; a second run
 *          over a normalized manuscript returns empty collections.
 */
export async function normalizeBlockFiles(
  ws: WorkspaceAdapter,
  dir: string,
): Promise<NormalizeBlockFilesResult> {
  const blocksDir = `${dir}/blocks`;
  const files = await ws.listFiles(blocksDir);
  const renamed: Array<{ from: string; to: string }> = [];
  const conflicts: string[] = [];

  for (const file of files) {
    if (file.endsWith('.qmd') && file.startsWith('_')) continue;
    const short = legacyBlockShort(file);
    if (short === null) continue;
    if (files.includes(`_${file}`)) {
      conflicts.push(short);
      continue;
    }
    const text = await ws.readFile(`${blocksDir}/${file}`);
    if (text === null) continue;
    await ws.writeFile(`${blocksDir}/_${file}`, text);
    await ws.deleteFile(`${blocksDir}/${file}`);
    renamed.push({ from: `${blocksDir}/${file}`, to: `${blocksDir}/_${file}` });
  }

  conflicts.sort();
  const conflicted = new Set(conflicts);
  const articlePath = `${dir}/article.qmd`;
  const article = await ws.readFile(articlePath);
  if (article !== null) {
    // Only non-conflicted shorts get their include line canonicalized.
    const updated = article.replace(LEGACY_INCLUDE_RE, (line, short: string) =>
      conflicted.has(short) ? line : includeLine(short),
    );
    if (updated !== article) await ws.writeFile(articlePath, updated);
  }

  return { renamed, conflicts };
}

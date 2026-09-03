/**
 * Article compiler: assembles article.qmd from a block manifest.
 */

import { validateManifest, validateAssembly, type ManifestData } from '@opendraft/schema';

/** Front matter block with metadata-files list. */
function buildFrontMatter(metadataFiles: string[]): string[] {
  const lines = ['---', 'metadata-files:'];
  for (const file of metadataFiles) {
    lines.push(`  - ${file}`);
  }
  lines.push('---');
  lines.push('');
  return lines;
}

/** Block include shortcodes in manifest order. */
function buildBlockIncludes(blocks: ManifestData['blocks']): string[] {
  const lines: string[] = [];
  for (const block of blocks) {
    lines.push(`{{< include blocks/${block.file} >}}`);
    lines.push('');
  }
  return lines;
}

/** References section at the end of the article. */
function buildReferencesSection(): string[] {
  return ['# References', '', '::: {#refs}', ':::'];
}

/**
 * Compile article.qmd content from a block manifest.
 *
 * Assembles the article by emitting metadata-files front matter,
 * one {{< include >}} shortcode per block in manifest order,
 * and a References section.
 *
 * @param manifest - Parsed manifest.json object.
 * @param metadataFiles - Newline-separated metadata file names for front matter.
 * @param blocks - Map of filename to block content (keys validated against manifest).
 * @returns Assembled article.qmd content as a string.
 * @throws {Error} If manifest is invalid or a block file is missing.
 */
export function compileArticle(
  manifest: unknown,
  metadataFiles: string,
  blocks: Record<string, string>,
): string {
  const result = validateManifest(manifest);
  if (!result.valid) {
    const errors = result.errors.map((e) => `${e.path}: ${e.message}`).join(', ');
    throw new Error(`Invalid manifest: ${errors}`);
  }

  const m = manifest as ManifestData;
  validateBlockFilesExist(m, blocks);

  const files = parseMetadataFileList(metadataFiles);
  const parts = [
    buildFrontMatter(files),
    buildBlockIncludes(m.blocks),
    buildReferencesSection(),
  ];
  return parts.flat().join('\n');
}

/** Parse newline-separated metadata file list, filtering blanks. */
function parseMetadataFileList(raw: string): string[] {
  return raw.split('\n').map((f) => f.trim()).filter(Boolean);
}

/** Validate that every manifest block has a corresponding non-empty file. */
function validateBlockFilesExist(
  manifest: ManifestData,
  blocks: Record<string, string>,
): void {
  for (const block of manifest.blocks) {
    if (!(block.file in blocks)) {
      throw new Error(`Missing block file: blocks/${block.file}`);
    }
    if (blocks[block.file].trim() === '') {
      throw new Error(`Empty block file: blocks/${block.file}`);
    }
  }
}

export interface AssemblyCompileResult {
  success: boolean;
  /** Normalized article.qmd content when validation passed. */
  article: string;
  /** Blocking validation errors. */
  errors: string[];
}

/**
 * Validate and normalize an authored assembly into article.qmd.
 *
 * The assembly is the source of truth: front matter, glue prose and the
 * references trailer pass through verbatim; only include shortcodes are
 * rewritten to their canonical `{{< include blocks/<file>.qmd >}}` form.
 * Draft (orphan) files are allowed; they simply are not included.
 *
 * @param assembly - Authored assembly markdown (article.qmd content).
 * @param blocks - Block contents keyed by `blocks/<slug>.qmd`.
 * @returns The compile result with diagnostics.
 */
export function compileAssembly(assembly: string, blocks: Record<string, string>): AssemblyCompileResult {
  const validation = validateAssembly({ assembly, blockFiles: blocks, files: [] });
  if (!validation.valid) {
    return { success: false, article: '', errors: validation.errors.map((e) => `${e.path}: ${e.message}`) };
  }

  const canonical = assembly.replace(
    /\{\{< include\s+(blocks\/[a-z0-9][a-z0-9-]*\.qmd)\s*>\}\}/g,
    (_line: string, path: string) => `{{< include ${path} >}}`,
  );
  return { success: true, article: `${canonical.trimEnd()}\n`, errors: [] };
}

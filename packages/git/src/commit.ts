import type { WorkspaceAdapter } from '@opendraft/workspace';
import { compileAssembly } from '@opendraft/metadata/src/article-compiler.js';
import { validateAssembly } from '@opendraft/schema';

interface PreCommitResult {
  success: boolean;
  /** Blocking errors (missing/malformed assembly or blocks). */
  errors: string[];
  /** Non-blocking findings (e.g. draft files not included). */
  warnings: string[];
  article: string;
}

/** Path of the authored assembly at the manuscript root. */
export const ARTICLE_PATH = 'article.qmd';

/** Directory holding per-slug block files. */
export const BLOCKS_DIR = 'blocks/';

/**
 * Pre-commit assembly flow (assembly-first).
 *
 * Reads the authored article.qmd plus blocks/, validates file<->include
 * consistency, normalizes include shortcodes and writes article.qmd back.
 * Draft (orphan) block files are reported as warnings, never failing the
 * commit.
 *
 * @param workspace - Workspace adapter for file I/O.
 * @param articlePath - Authored assembly path (default article.qmd).
 * @param blocksDir - Block directory (default blocks/).
 * @returns Pre-commit result with diagnostics and the normalized article.
 */
export async function preCommitAssembly(
  workspace: WorkspaceAdapter,
  articlePath: string = ARTICLE_PATH,
  blocksDir: string = BLOCKS_DIR,
): Promise<PreCommitResult> {
  const assembly = await workspace.readFile(articlePath);
  if (assembly === null) {
    return { success: false, errors: [`${articlePath} not found`], warnings: [], article: '' };
  }

  const files = await workspace.listFiles(blocksDir);
  const blockFiles: Record<string, string> = {};
  for (const file of files) {
    if (!file.endsWith('.qmd')) continue;
    const content = await workspace.readFile(`${blocksDir}${file}`);
    if (content !== null) blockFiles[`blocks/${file}`] = content;
  }

  const validation = validateAssembly({ assembly, blockFiles, files });
  const warnings = validation.warnings.map((entry) => `${entry.path}: ${entry.message}`);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors.map((entry) => `${entry.path}: ${entry.message}`),
      warnings,
      article: '',
    };
  }

  const result = compileAssembly(assembly, blockFiles);
  if (!result.success) {
    return { success: false, errors: result.errors, warnings, article: '' };
  }

  await workspace.writeFile(articlePath, result.article);
  return { success: true, errors: [], warnings, article: result.article };
}
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { compileAssembly } from '@opendraft/metadata/src/article-compiler.js';
import { checkManuscriptAssembly } from '@opendraft/validate';

interface PreCommitResult {
  success: boolean;
  /** Blocking errors (missing/malformed assembly or blocks). */
  errors: string[];
  /** Non-blocking findings (e.g. draft files not included). */
  warnings: string[];
  article: string;
}

/**
 * Pre-commit assembly flow (assembly-first).
 *
 * Reads `${dir}/article.qmd` plus `${dir}/blocks/`, delegates assembly checks
 * to the shared manuscript-stage validator, normalizes include shortcodes and
 * writes article.qmd back. Orphan drafts are warnings only.
 *
 * @param workspace - Workspace adapter for file I/O.
 * @param dir - Project-relative manuscript directory.
 * @returns Pre-commit result with diagnostics and the normalized article.
 */
export async function preCommitAssembly(
  workspace: WorkspaceAdapter,
  dir: string = '',
): Promise<PreCommitResult> {
  const base = dir.replace(/\/+$/, '');
  const articlePath = base === '' ? 'article.qmd' : `${base}/article.qmd`;
  const assembly = await workspace.readFile(articlePath);
  if (assembly === null) {
    return { success: false, errors: [`${articlePath} not found`], warnings: [], article: '' };
  }

  const findings = await checkManuscriptAssembly(workspace, base);
  const fmt = (f: { path: string; message: string }): string =>
    `${f.path}: ${f.message.replace(/(block file name: )([^\s;]+)/, `$1${base}/blocks/$2`)}`;
  const warnings = findings.filter((f) => f.level === 'warning').map(fmt);
  const errors = findings.filter((f) => f.level === 'error').map(fmt);
  if (errors.length > 0) return { success: false, errors, warnings, article: '' };

  const blockFiles: Record<string, string> = {};
  for (const file of await workspace.listFiles(`${base}/blocks`)) {
    if (!file.endsWith('.qmd')) continue;
    const content = await workspace.readFile(`${base}/blocks/${file}`);
    if (content !== null) blockFiles[`blocks/${file}`] = content;
  }

  const result = compileAssembly(assembly, blockFiles);
  if (!result.success) return { success: false, errors: result.errors, warnings, article: '' };

  await workspace.writeFile(articlePath, result.article);
  return { success: true, errors: [], warnings, article: result.article };
}

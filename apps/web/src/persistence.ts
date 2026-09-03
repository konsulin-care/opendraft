import type { WorkspaceAdapter } from '@opendraft/workspace';
import { parseManuscript, serializeManuscript, type Node } from '@opendraft/editor';

/** Path of the authored assembly file at the manuscript root. */
export const ARTICLE_PATH = 'article.qmd';

/** Directory holding one block file per section slug. */
export const BLOCKS_DIR = 'blocks/';

export interface LoadedManuscript {
  /** Reconstructed manuscript document. */
  doc: Node;
  /** Warnings for assembly includes without a matching block file. */
  warnings: string[];
}

/**
 * Load a manuscript from the workspace: read article.qmd plus every
 * blocks/<slug>.qmd file and rebuild the editor document.
 *
 * @param workspace - Workspace adapter for file I/O.
 * @returns The reconstructed document and any include warnings.
 */
export async function loadManuscript(workspace: WorkspaceAdapter): Promise<LoadedManuscript> {
  const assembly = (await workspace.readFile(ARTICLE_PATH)) ?? '';
  const blockFiles: Record<string, string> = {};

  const files = await workspace.listFiles(BLOCKS_DIR);
  for (const file of files) {
    if (!file.endsWith('.qmd')) continue;
    const content = await workspace.readFile(`${BLOCKS_DIR}${file}`);
    if (content === null) continue;
    blockFiles[file.replace(/\.qmd$/, '')] = content;
  }

  return parseManuscript({ assembly, blockFiles });
}

/**
 * Save a manuscript to the workspace: write article.qmd (include assembly)
 * and one blocks/<slug>.qmd per section, removing stale block files.
 *
 * @param workspace - Workspace adapter for file I/O.
 * @param doc - The manuscript document to persist.
 */
export async function saveManuscript(workspace: WorkspaceAdapter, doc: Node): Promise<void> {
  const { assembly, blocks } = serializeManuscript(doc);

  await workspace.writeFile(ARTICLE_PATH, `${assembly.trimEnd()}\n`);

  const existing = await workspace.listFiles(BLOCKS_DIR);
  const wanted = new Set(blocks.keys());
  for (const file of existing) {
    if (!file.endsWith('.qmd')) continue;
    const slug = file.replace(/\.qmd$/, '');
    if (!wanted.has(slug)) {
      await workspace.deleteFile(`${BLOCKS_DIR}${file}`);
    }
  }

  for (const [slug, content] of blocks) {
    await workspace.writeFile(`${BLOCKS_DIR}${slug}.qmd`, `${content.trimEnd()}\n`);
  }
}
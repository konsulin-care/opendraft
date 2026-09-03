import type { WorkspaceAdapter } from '@opendraft/workspace';

/** Path of the authored assembly file at the manuscript root. */
export const DEFAULT_ARTICLE_PATH = 'article.qmd';

/** Slug of the default starter block. */
export const DEFAULT_BLOCK_ID = 'intro';

/** Starter block content (markdown with an explicit `{#intro}` id). */
export const DEFAULT_BLOCK_CONTENT = [
  '# Introduction {#intro}',
  '',
  'Start writing your manuscript here. Use the block handle to add sections.',
].join('\n');

/** Starter assembly: one include plus the references trailer. */
export const DEFAULT_ARTICLE_ASSEMBLY = [
  '{{< include blocks/intro.qmd >}}',
  '',
  '# References',
  '',
  '::: {#refs}',
  ':::',
].join('\n');

/**
 * Seed an empty workspace with a starter manuscript: article.qmd (the
 * authored include assembly) plus one blocks/intro.qmd block file.
 *
 * @param workspace - Workspace adapter to seed (in-place).
 */
export async function seedWorkspace(workspace: WorkspaceAdapter): Promise<void> {
  await workspace.writeFile(`blocks/${DEFAULT_BLOCK_ID}.qmd`, `${DEFAULT_BLOCK_CONTENT}\n`);
  await workspace.writeFile(DEFAULT_ARTICLE_PATH, `${DEFAULT_ARTICLE_ASSEMBLY}\n`);
}
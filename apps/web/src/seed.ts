import type { WorkspaceAdapter } from '@opendraft/workspace';

export const DEFAULT_MANIFEST_PATH = 'blocks/manifest.json';
export const DEFAULT_BLOCK_ID = 'intro';
export const DEFAULT_BLOCK_TITLE = 'Introduction';
export const DEFAULT_BLOCK_CONTENT =
  '<div data-section><h1>Introduction</h1><p></p></div>';

/**
 * Seed an empty workspace with a default manifest and one starter block.
 *
 * Writes a schema-valid blocks/manifest.json (version 1.0.0) with a single
 * block and its starter .qmd file, so a fresh workspace is not blank.
 *
 * @param workspace - Workspace adapter to seed (in-place).
 */
export async function seedWorkspace(workspace: WorkspaceAdapter): Promise<void> {
  const manifest = {
    version: '1.0.0',
    blocks: [{
      id: DEFAULT_BLOCK_ID,
      file: `${DEFAULT_BLOCK_ID}.qmd`,
      title: DEFAULT_BLOCK_TITLE,
    }],
  };
  await workspace.writeFile(DEFAULT_MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  await workspace.writeFile(`blocks/${DEFAULT_BLOCK_ID}.qmd`, DEFAULT_BLOCK_CONTENT);
}
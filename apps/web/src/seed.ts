import type { WorkspaceAdapter } from '@opendraft/workspace';
import { MANUSCRIPT_PATH, saveManuscript } from './persistence';

/** Path of the manuscript file at the workspace root. */
export const DEFAULT_ARTICLE_PATH = MANUSCRIPT_PATH;

/** Starter manuscript content — plain commonmark, no blocks or includes. */
export const STARTER_MANUSCRIPT = [
  '# Introduction',
  '',
  'Start writing your manuscript here.',
].join('\n');

/**
 * Ensure a workspace has a starter manuscript: creates the single
 * markdown file when the workspace is empty.
 *
 * @param workspace - Workspace adapter to seed (in-place).
 */
export async function seedWorkspace(workspace: WorkspaceAdapter): Promise<void> {
  if ((await workspace.readFile(MANUSCRIPT_PATH)) !== null) return;
  await saveManuscript(workspace, STARTER_MANUSCRIPT);
}
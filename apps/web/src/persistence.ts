import type { WorkspaceAdapter } from '@opendraft/workspace';

/** Path of the single manuscript markdown file at the workspace root. */
export const MANUSCRIPT_PATH = 'manuscript.md';

/**
 * Load the whole manuscript as a single markdown document.
 *
 * @param workspace - Workspace adapter for file I/O.
 * @returns The raw manuscript markdown, or an empty string if absent.
 */
export async function loadManuscript(workspace: WorkspaceAdapter): Promise<string> {
  return (await workspace.readFile(MANUSCRIPT_PATH)) ?? '';
}

/**
 * Save the whole manuscript as a single markdown file.
 *
 * @param workspace - Workspace adapter for file I/O.
 * @param markdown - The manuscript markdown to persist.
 */
export async function saveManuscript(workspace: WorkspaceAdapter, markdown: string): Promise<void> {
  await workspace.writeFile(MANUSCRIPT_PATH, `${markdown.trimEnd()}\n`);
}
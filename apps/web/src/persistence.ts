import type { WorkspaceAdapter } from '@opendraft/workspace';

/** Path of the single manuscript markdown file at the workspace root. */
export const MANUSCRIPT_PATH = 'manuscript.md';

/**
 * Load a file's text content from the workspace.
 *
 * @param workspace - Workspace adapter for file I/O.
 * @param path - Repo-relative path of the file to read.
 * @returns The raw file text, or an empty string if the file is absent.
 */
export async function loadFile(workspace: WorkspaceAdapter, path: string): Promise<string> {
  return (await workspace.readFile(path)) ?? '';
}

/**
 * Save text to an explicit workspace path. Trailing whitespace is trimmed
 * and exactly one trailing newline is written.
 *
 * @param workspace - Workspace adapter for file I/O.
 * @param path - Repo-relative path of the file to write.
 * @param text - The text to persist.
 */
export async function saveFile(workspace: WorkspaceAdapter, path: string, text: string): Promise<void> {
  await workspace.writeFile(path, `${text.trimEnd()}\n`);
}

/**
 * Load the whole manuscript as a single markdown document.
 * Legacy single-manuscript helper; superseded by {@link loadFile}.
 *
 * @param workspace - Workspace adapter for file I/O.
 * @returns The raw manuscript markdown, or an empty string if absent.
 */
export async function loadManuscript(workspace: WorkspaceAdapter): Promise<string> {
  return loadFile(workspace, MANUSCRIPT_PATH);
}

/**
 * Save the whole manuscript as a single markdown file.
 * Legacy single-manuscript helper; superseded by {@link saveFile}.
 *
 * @param workspace - Workspace adapter for file I/O.
 * @param markdown - The manuscript markdown to persist.
 */
export async function saveManuscript(workspace: WorkspaceAdapter, markdown: string): Promise<void> {
  await saveFile(workspace, MANUSCRIPT_PATH, markdown);
}

import type { WorkspaceAdapter } from '@opendraft/workspace';

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

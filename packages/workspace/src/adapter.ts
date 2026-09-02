/**
 * Workspace adapter interface for file I/O operations.
 *
 * Provides a unified API for reading, writing, deleting, and listing files
 * in a workspace. Implementations can be in-memory (for tests), IndexedDB
 * (for browser), or filesystem (for Node.js).
 */
export interface WorkspaceAdapter {
  /**
   * Read file contents.
   * @param path - Relative path to the file.
   * @returns File contents as string, or null if file does not exist.
   */
  readFile(path: string): Promise<string | null>;

  /**
   * Write file contents. Creates the file if it does not exist.
   * @param path - Relative path to the file.
   * @param content - File contents to write.
   */
  writeFile(path: string, content: string): Promise<void>;

  /**
   * Delete a file. Does not throw if file does not exist.
   * @param path - Relative path to the file.
   */
  deleteFile(path: string): Promise<void>;

  /**
   * List files in a directory.
   * @param dir - Relative path to the directory.
   * @returns Array of filenames (not full paths) in the directory.
   */
  listFiles(dir: string): Promise<string[]>;
}

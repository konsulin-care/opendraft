import { openDB, type IDBPDatabase } from 'idb';
import type { WorkspaceAdapter } from './adapter.js';

const DB_NAME = 'opendraft-workspace';
const STORE_NAME = 'files';

/**
 * IndexedDB-backed workspace adapter for browser persistence.
 *
 * Stores files as key-value pairs in an IndexedDB object store.
 * Each instance uses a unique database name based on the workspace ID.
 */
export class IndexedDBWorkspace implements WorkspaceAdapter {
  private dbPromise: Promise<IDBPDatabase>;
  private workspaceId: string;

  /**
   * Create an IndexedDB workspace.
   * @param workspaceId - Unique identifier for this workspace (used as DB name suffix).
   */
  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.dbPromise = this.initDB();
  }

  /** Initialize the IndexedDB database. */
  private async initDB(): Promise<IDBPDatabase> {
    return openDB(`${DB_NAME}-${this.workspaceId}`, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }

  /** Get the database instance. */
  private async getDB(): Promise<IDBPDatabase> {
    return this.dbPromise;
  }

  /** Normalize path by removing leading ./ and ensuring consistent separators. */
  private normalize(path: string): string {
    return path.replace(/^\.\//, '').replace(/\\/g, '/');
  }

  /**
   * Read file contents.
   * @param path - Relative path to the file.
   * @returns File contents as string, or null if file does not exist.
   */
  async readFile(path: string): Promise<string | null> {
    const db = await this.getDB();
    const content = await db.get(STORE_NAME, this.normalize(path));
    return content ?? null;
  }

  /**
   * Write file contents. Creates the file if it does not exist.
   * @param path - Relative path to the file.
   * @param content - File contents to write.
   */
  async writeFile(path: string, content: string): Promise<void> {
    const db = await this.getDB();
    await db.put(STORE_NAME, content, this.normalize(path));
  }

  /**
   * Delete a file. Does not throw if file does not exist.
   * @param path - Relative path to the file.
   */
  async deleteFile(path: string): Promise<void> {
    const db = await this.getDB();
    await db.delete(STORE_NAME, this.normalize(path));
  }

  /**
   * Close the underlying IndexedDB connection.
   *
   * Call when the workspace is no longer needed (e.g. navigation or teardown)
   * so the connection does not block database deletion or upgrade.
   */
  async close(): Promise<void> {
    const db = await this.getDB();
    db.close();
  }

  /**
   * List files in a directory.
   * @param dir - Relative path to the directory.
   * @returns Array of filenames (not full paths) in the directory.
   */
  async listFiles(dir: string): Promise<string[]> {
    const db = await this.getDB();
    const normalizedDir = this.normalize(dir);
    const prefix = normalizedDir.endsWith('/') ? normalizedDir : `${normalizedDir}/`;

    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const keys = await store.getAllKeys();

    const files: string[] = [];
    for (const key of keys) {
      const keyStr = String(key);
      if (keyStr.startsWith(prefix)) {
        const relative = keyStr.slice(prefix.length);
        // Only include direct children (no subdirectory nesting)
        if (!relative.includes('/')) {
          files.push(relative);
        }
      }
    }
    return files;
  }
}

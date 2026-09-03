import type { WorkspaceAdapter } from './adapter.js';

/**
 * In-memory workspace implementation for testing.
 *
 * Stores files in a Map with normalized paths (leading ./ removed).
 * Directories are implicit — listFiles filters by prefix.
 */
export class MemoryWorkspace implements WorkspaceAdapter {
  private files = new Map<string, string>();

  /** Normalize path by removing leading ./ and ensuring consistent separators. */
  private normalize(path: string): string {
    return path.replace(/^\.\//, '').replace(/\\/g, '/');
  }

  async readFile(path: string): Promise<string | null> {
    return this.files.get(this.normalize(path)) ?? null;
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(this.normalize(path), content);
  }

  async deleteFile(path: string): Promise<void> {
    this.files.delete(this.normalize(path));
  }

  async listFiles(dir: string): Promise<string[]> {
    const normalizedDir = this.normalize(dir);
    const prefix = normalizedDir.endsWith('/') ? normalizedDir : `${normalizedDir}/`;

    const files: string[] = [];
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) {
        const relative = key.slice(prefix.length);
        // Only include direct children (no subdirectory nesting)
        if (!relative.includes('/')) {
          files.push(relative);
        }
      }
    }
    return files;
  }
}

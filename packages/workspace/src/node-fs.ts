import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import type { WorkspaceAdapter } from './adapter.js';

/**
 * Node-only filesystem workspace adapter rooted at a directory.
 *
 * All workspace paths are relative to the root directory; any path that
 * resolves outside the root is rejected. Exported via
 * `@opendraft/workspace/node` — never from the browser index.
 */
export class NodeFsWorkspace implements WorkspaceAdapter {
  /** Absolute path of the workspace root directory. */
  readonly root: string;

  /**
   * Create a workspace rooted at a directory.
   * @param root - Directory the workspace is rooted at; created on first write.
   */
  constructor(root: string) {
    this.root = resolve(root);
  }

  /**
   * Resolve a workspace-relative path against the root.
   * @param path - Path relative to the workspace root (may contain `..`).
   * @returns Absolute path guaranteed to stay inside the root.
   * @throws If the path resolves outside the workspace root.
   */
  private resolvePath(path: string): string {
    const abs = resolve(this.root, path);
    const rel = relative(this.root, abs);
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
      throw new Error(`Path escapes workspace root: ${path}`);
    }
    return abs;
  }

  /**
   * Read file contents.
   * @param path - Relative path to the file.
   * @returns File contents as string, or null if the file does not exist.
   * @throws If the path escapes the workspace root.
   */
  async readFile(path: string): Promise<string | null> {
    const abs = this.resolvePath(path);
    try {
      return await readFile(abs, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  /**
   * Write file contents, creating parent directories as needed.
   * @param path - Relative path to the file.
   * @param content - File contents to write.
   * @throws If the path escapes the workspace root.
   */
  async writeFile(path: string, content: string): Promise<void> {
    const abs = this.resolvePath(path);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, content, 'utf8');
  }

  /**
   * Delete a file. Does not throw if the file does not exist.
   * @param path - Relative path to the file.
   * @throws If the path escapes the workspace root.
   */
  async deleteFile(path: string): Promise<void> {
    const abs = this.resolvePath(path);
    await rm(abs, { force: true });
  }

  /**
   * List files directly inside a directory.
   * @param dir - Relative path to the directory.
   * @returns Basenames of direct file children, or [] if the directory is missing.
   * @throws If the path escapes the workspace root.
   */
  async listFiles(dir: string): Promise<string[]> {
    const abs = this.resolvePath(dir);
    try {
      const entries = await readdir(abs, { withFileTypes: true });
      return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  /**
   * List every file in the workspace, recursively.
   * @returns Sorted array of all file paths, root-relative with `/` separators.
   */
  async listAll(): Promise<string[]> {
    const files: string[] = [];

    const walk = async (relDir: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(resolve(this.root, relDir), { withFileTypes: true });
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
        throw err;
      }
      for (const entry of entries) {
        const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          await walk(rel);
        } else if (entry.isFile()) {
          files.push(rel);
        }
      }
    };

    await walk('');
    return files.sort();
  }
}

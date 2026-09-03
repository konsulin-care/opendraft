/** Interface for stat results used by isomorphic-git. */
interface GitStat {
  type: 'file' | 'dir';
  mode: number;
  size: number;
  isDirectory: () => boolean;
  isFile: () => boolean;
  isSymbolicLink: () => boolean;
  ctimeMs: number;
  mtimeMs: number;
  atimeMs: number;
  ctime: Date;
  mtime: Date;
  atime: Date;
}

/**
 * In-memory filesystem for isomorphic-git testing.
 * Implements the Node.js fs.promises API subset used by isomorphic-git.
 */
class MemoryFSPromises {
  private files = new Map<string, Uint8Array>();
  private dirs = new Set<string>(['/']);

  private normalize(filepath: string): string {
    return filepath.replace(/^\.\//, '').replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  }

  /**
   * Ensure all directories exist in the path.
   * @param filepath - File path.
   */
  private ensureAllDirs(filepath: string): void {
    const parts = filepath.split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
      current += '/' + part;
      this.dirs.add(current);
    }
  }

  /**
   * Ensure parent directories exist.
   * @param filepath - File path.
   */
  private ensureParentDirs(filepath: string): void {
    const parts = filepath.split('/').filter(Boolean);
    let current = '';
    for (const part of parts.slice(0, -1)) {
      current += '/' + part;
      this.dirs.add(current);
    }
  }

  /**
   * Create directory.
   * @param filepath - Directory path.
   * @param _opts - Options (ignored).
   */
  async mkdir(filepath: string, _opts?: unknown): Promise<void> {
    const normalized = this.normalize(filepath);
    this.dirs.add(normalized);
    this.ensureParentDirs(normalized);
  }

  /**
   * Remove directory.
   * @param filepath - Directory path.
   */
  async rmdir(filepath: string): Promise<void> {
    const normalized = this.normalize(filepath);
    this.dirs.delete(normalized);
  }

  /**
   * Read directory contents.
   * @param filepath - Directory path.
   * @returns Array of filenames.
   */
  async readdir(filepath: string): Promise<string[]> {
    const normalized = this.normalize(filepath);
    const prefix = normalized.endsWith('/') ? normalized : `${normalized}/`;
    const entries: string[] = [];

    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) {
        const relative = key.slice(prefix.length);
        if (!relative.includes('/')) {
          entries.push(relative);
        }
      }
    }

    for (const dir of this.dirs) {
      if (dir.startsWith(prefix) && dir !== normalized) {
        const relative = dir.slice(prefix.length);
        if (!relative.includes('/') && relative !== '') {
          entries.push(relative);
        }
      }
    }

    return entries;
  }

  /**
   * Write file contents.
   * @param filepath - File path.
   * @param data - File contents.
   * @param _opts - Options (encoding).
   */
  async writeFile(filepath: string, data: Uint8Array | string, _opts?: unknown): Promise<void> {
    const normalized = this.normalize(filepath);
    const content = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    this.files.set(normalized, content);
    this.ensureParentDirs(normalized);
  }

  /**
   * Read file contents.
   * @param filepath - File path.
   * @param _opts - Options (encoding).
   * @returns File contents.
   */
  async readFile(filepath: string, opts?: unknown): Promise<Uint8Array | string> {
    const normalized = this.normalize(filepath);
    const content = this.files.get(normalized);
    if (content === undefined) {
      throw Object.assign(new Error(`File not found: ${filepath}`), { code: 'ENOENT' });
    }

    const options = opts as { encoding?: string } | undefined;
    if (options?.encoding === 'utf8') {
      return new TextDecoder().decode(content);
    }
    return content;
  }

  /**
   * Delete a file.
   * @param filepath - File path.
   */
  async unlink(filepath: string): Promise<void> {
    const normalized = this.normalize(filepath);
    this.files.delete(normalized);
  }

  /**
   * Get file stats.
   * @param filepath - File path.
   * @returns Stat object with isDirectory and isFile methods.
   */
  private createBaseStat(): GitStat {
    const now = Date.now();
    return {
      ctimeMs: now,
      mtimeMs: now,
      atimeMs: now,
      ctime: new Date(now),
      mtime: new Date(now),
      atime: new Date(now),
      type: 'file',
      mode: 0o100644,
      size: 0,
      isDirectory: () => false,
      isFile: () => false,
      isSymbolicLink: () => false,
    };
  }

  async stat(filepath: string): Promise<GitStat> {
    const normalized = this.normalize(filepath);
    const checkPath = normalized === '.' ? '/' : normalized;

    if (this.files.has(checkPath)) {
      return {
        ...this.createBaseStat(),
        type: 'file',
        mode: 0o100644,
        size: this.files.get(checkPath)!.length,
        isDirectory: () => false,
        isFile: () => true,
      };
    }

    if (this.dirs.has(checkPath)) {
      return {
        ...this.createBaseStat(),
        type: 'dir',
        mode: 0o40000,
        size: 0,
        isDirectory: () => true,
        isFile: () => false,
      };
    }

    throw Object.assign(new Error(`File not found: ${filepath}`), { code: 'ENOENT' });
  }

  async lstat(filepath: string): Promise<GitStat> {
    if (filepath === '.' || filepath.endsWith('/.')) {
      return {
        ...this.createBaseStat(),
        type: 'dir',
        mode: 0o40000,
        size: 0,
        isDirectory: () => true,
        isFile: () => false,
      };
    }
    return this.stat(filepath);
  }

  /**
   * Rename a file.
   * @param oldFilepath - Old file path.
   * @param newFilepath - New file path.
   */
  async rename(oldFilepath: string, newFilepath: string): Promise<void> {
    const oldNormalized = this.normalize(oldFilepath);
    const newNormalized = this.normalize(newFilepath);

    const content = this.files.get(oldNormalized);
    if (content !== undefined) {
      this.files.delete(oldNormalized);
      this.files.set(newNormalized, content);
    }
  }

  /**
   * Read symlink target.
   * @param filepath - Symlink path.
   * @returns Target path.
   */
  async readlink(filepath: string): Promise<string> {
    throw Object.assign(new Error(`Not a symlink: ${filepath}`), { code: 'EINVAL' });
  }

  /**
   * Create symlink.
   * @param target - Target path.
   * @param filepath - Symlink path.
   */
  async symlink(_target: string, _filepath: string): Promise<void> {
    throw Object.assign(new Error('Symlinks not supported'), { code: 'ENOSYS' });
  }

  /**
   * Change file mode.
   * @param filepath - File path.
   * @param _mode - File mode.
   */
  async chmod(_filepath: string, _mode: number): Promise<void> {
    // No-op for in-memory filesystem
  }
}

/**
 * In-memory filesystem for isomorphic-git.
 * Wraps MemoryFSPromises to provide the interface expected by isomorphic-git.
 */
export class MemoryFS {
  readonly promises: MemoryFSPromises;

  constructor() {
    this.promises = new MemoryFSPromises();
    // Make promises enumerable for isomorphic-git detection
    Object.defineProperty(this, 'promises', {
      value: new MemoryFSPromises(),
      enumerable: true,
      writable: false,
      configurable: false,
    });
  }
}

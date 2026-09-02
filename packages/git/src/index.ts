import git from 'isomorphic-git';
import { MemoryFS } from './memory-fs.js';

/**
 * Git operations using isomorphic-git with in-memory filesystem.
 * In production, this would use LightningFS or another browser-compatible filesystem.
 */
export class GitOperations {
  private fs: MemoryFS;
  private dir: string;

  /**
   * Create Git operations instance.
   * @param _workspace - Workspace adapter (reserved for future use).
   * @param dir - Repository directory path (default: '/').
   */
  constructor(_workspace: unknown, dir = '/') {
    this.fs = new MemoryFS();
    this.dir = dir;
  }

  /**
   * Initialize a new Git repository.
   */
  async initRepo(): Promise<void> {
    await git.init({
      fs: this.fs,
      dir: this.dir,
    });
  }

  /**
   * Check if repository is initialized.
   * @returns True if .git directory exists.
   */
  async isInitialized(): Promise<boolean> {
    try {
      await git.resolveRef({
        fs: this.fs,
        dir: this.dir,
        ref: 'HEAD',
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Commit all staged files.
   * @param message - Commit message.
   * @returns Commit hash.
   * @throws Error if repository is not initialized.
   */
  async commit(message: string): Promise<string> {
    const isInit = await this.isInitialized();
    if (!isInit) {
      throw new Error('Repository not initialized');
    }

    // Stage all files
    const statusMatrix = await git.statusMatrix({
      fs: this.fs,
      dir: this.dir,
    });

    for (const [filepath, , workdirStatus] of statusMatrix) {
      if (workdirStatus === 1 || workdirStatus === 2) {
        await git.add({
          fs: this.fs,
          dir: this.dir,
          filepath,
        });
      }
    }

    // Create commit
    const sha = await git.commit({
      fs: this.fs,
      dir: this.dir,
      message,
      author: {
        name: 'OpenDraft',
        email: 'opendraft@example.com',
        timestamp: Date.now(),
        timezoneOffset: 0,
      },
    });

    return sha;
  }
}

export { MemoryFS } from './memory-fs.js';

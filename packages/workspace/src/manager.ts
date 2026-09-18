import { IndexedDBWorkspace } from './indexeddb.js';

interface WorkspaceEntry {
  instance: IndexedDBWorkspace;
  refCount: number;
}

/**
 * Manages IndexedDB workspace instances with reference counting.
 * Ensures a single connection per workspace ID and closes
 * the database only when the last reference is released.
 */
export class WorkspaceManager {
  private workspaces = new Map<string, WorkspaceEntry>();

  /**
   * Get or create a workspace instance.
   * Increments reference count.
   * @param workspaceId - Unique workspace identifier.
   * @returns The workspace instance (awaits DB ready).
   */
  async get(workspaceId: string): Promise<IndexedDBWorkspace> {
    const existing = this.workspaces.get(workspaceId);
    if (existing) {
      existing.refCount++;
      return existing.instance;
    }

    const instance = new IndexedDBWorkspace(workspaceId);
    await instance.ready();
    this.workspaces.set(workspaceId, { instance, refCount: 1 });
    return instance;
  }

  /**
   * Release a workspace reference.
   * Closes the database when reference count reaches zero.
   * @param workspaceId - Workspace to release.
   */
  release(workspaceId: string): void {
    const entry = this.workspaces.get(workspaceId);
    if (!entry) return;

    entry.refCount--;
    if (entry.refCount === 0) {
      entry.instance.close();
      this.workspaces.delete(workspaceId);
    }
  }

  /**
   * Force close all workspaces.
   * Use on app shutdown or logout.
   */
  async closeAll(): Promise<void> {
    for (const [, entry] of this.workspaces) {
      await entry.instance.close();
    }
    this.workspaces.clear();
  }

  /**
   * Check if a workspace is currently tracked.
   * @param workspaceId - Workspace to check.
   * @returns True if workspace is managed.
   */
  has(workspaceId: string): boolean {
    return this.workspaces.has(workspaceId);
  }
}

/** Singleton instance for app-wide workspace management. */
export const workspaceManager = new WorkspaceManager();
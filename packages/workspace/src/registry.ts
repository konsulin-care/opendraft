import { openDB, type IDBPDatabase } from 'idb';
import { REGISTRY_DB } from './db-names.js';
import { workspaceManager, type WorkspaceManager } from './manager.js';

const PROJECTS_STORE = 'projects';
const META_STORE = 'meta';
const DB_VERSION = 1;

/** A local, on-disk project source. */
export interface ProjectSourceLocal {
  kind: 'local';
}

/** A GitHub-hosted project source (reserved for future clone support). */
export interface ProjectSourceGitHub {
  kind: 'github';
  owner: string;
  repo: string;
  branch: string;
}

/** Where a project's files come from. Union so GitHub sources can be added later. */
export type ProjectSource = ProjectSourceLocal | ProjectSourceGitHub;

/** Persistent record describing a writing project. */
export interface ProjectRecord {
  /** Stable project identifier (UUID). Never changes after creation. */
  id: string;
  /** Human-readable project name. */
  name: string;
  /** Where the project's files come from. */
  source: ProjectSource;
  /** Creation time (epoch milliseconds). */
  createdAt: number;
  /** Last-opened time (epoch milliseconds); drives list ordering. */
  lastOpenedAt: number;
  /**
   * Optional map of manuscript directory name to its user-facing display name.
   * Records created before this field existed keep working without it.
   */
  manuscriptNames?: Record<string, string>;
}

/** Per-project metadata, keyed by project id. */
interface ProjectMeta {
  lastPath: string | null;
}

/** Monotonic clock so lastOpenedAt values are strictly increasing within a process. */
let lastTimestamp = 0;

/**
 * Produce a strictly increasing timestamp.
 * Guarantees deterministic lastOpenedAt ordering even when operations
 * land within the same millisecond.
 * @returns A timestamp in epoch milliseconds, greater than any previously returned.
 */
function nextTimestamp(): number {
  lastTimestamp = Math.max(Date.now(), lastTimestamp + 1);
  return lastTimestamp;
}

/**
 * Project registry backed by the shared `od-registry` IndexedDB database.
 *
 * Stores project records in the `projects` store (keyed by id) and
 * per-project metadata such as the last opened file in the `meta` store.
 * Removing a project also destroys its `od-ws-<id>` workspace database
 * via the {@link WorkspaceManager}.
 */
export class ProjectRegistry {
  private dbPromise: Promise<IDBPDatabase>;
  private manager: WorkspaceManager;

  /**
   * Open the registry database.
   * @param manager - Workspace manager used to destroy workspaces on remove. Defaults to the singleton.
   */
  constructor(manager: WorkspaceManager = workspaceManager) {
    this.manager = manager;
    this.dbPromise = openDB(REGISTRY_DB, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
          db.createObjectStore(PROJECTS_STORE);
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE);
        }
      },
    });
  }

  /**
   * Wait until the registry database connection is open.
   * @returns Resolves when the database is ready.
   */
  async ready(): Promise<void> {
    await this.dbPromise;
  }

  /** Get the database instance. */
  private async getDB(): Promise<IDBPDatabase> {
    return this.dbPromise;
  }

  /**
   * List all projects, most recently opened first.
   * @returns Project records sorted by `lastOpenedAt` descending.
   */
  async list(): Promise<ProjectRecord[]> {
    const db = await this.getDB();
    const records = (await db.getAll(PROJECTS_STORE)) as ProjectRecord[];
    return records.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
  }

  /**
   * Get a single project record.
   * @param id - Project id.
   * @returns The record, or undefined if no project with that id exists.
   */
  async get(id: string): Promise<ProjectRecord | undefined> {
    const db = await this.getDB();
    return (await db.get(PROJECTS_STORE, id)) as ProjectRecord | undefined;
  }

  /**
   * Create a new project with a fresh UUID and local source.
   * @param name - Human-readable project name.
   * @returns The created record.
   */
  async create(name: string): Promise<ProjectRecord> {
    const now = nextTimestamp();
    const record: ProjectRecord = {
      id: crypto.randomUUID(),
      name,
      source: { kind: 'local' },
      createdAt: now,
      lastOpenedAt: now,
    };
    const db = await this.getDB();
    await db.put(PROJECTS_STORE, record, record.id);
    return record;
  }

  /**
   * Rename a project. The id never changes.
   * @param id - Project id.
   * @param name - New project name.
   * @returns The updated record.
   */
  async rename(id: string, name: string): Promise<ProjectRecord> {
    const db = await this.getDB();
    const record = (await db.get(PROJECTS_STORE, id)) as ProjectRecord | undefined;
    if (!record) {
      throw new Error(`Project not found: ${id}`);
    }
    const updated: ProjectRecord = { ...record, name };
    await db.put(PROJECTS_STORE, updated, id);
    return updated;
  }

  /**
   * Get the display name for a manuscript directory in a project.
   * @param id - Project id.
   * @param dirName - Manuscript directory name under `manuscripts/`.
   * @returns The stored display name, or undefined when unset or the project has no map.
   */
  async getManuscriptDisplayName(id: string, dirName: string): Promise<string | undefined> {
    const db = await this.getDB();
    const record = (await db.get(PROJECTS_STORE, id)) as ProjectRecord | undefined;
    return record?.manuscriptNames?.[dirName];
  }

  /**
   * Set the display name for a manuscript directory in a project.
   * @param id - Project id.
   * @param dirName - Manuscript directory name under `manuscripts/`.
   * @param displayName - User-facing manuscript name.
   * @returns The updated record.
   */
  async setManuscriptDisplayName(
    id: string,
    dirName: string,
    displayName: string,
  ): Promise<ProjectRecord> {
    const db = await this.getDB();
    const record = (await db.get(PROJECTS_STORE, id)) as ProjectRecord | undefined;
    if (!record) {
      throw new Error(`Project not found: ${id}`);
    }
    const updated: ProjectRecord = {
      ...record,
      manuscriptNames: { ...(record.manuscriptNames ?? {}), [dirName]: displayName },
    };
    await db.put(PROJECTS_STORE, updated, id);
    return updated;
  }

  /**
   * Move a manuscript directory key, carrying its display name to the new key.
   * A no-op when the source key holds no display name.
   * @param id - Project id.
   * @param fromDir - Existing manuscript directory name.
   * @param toDir - New manuscript directory name.
   * @returns The updated record, or the unchanged record when there was nothing to move.
   */
  async moveManuscriptKey(id: string, fromDir: string, toDir: string): Promise<ProjectRecord> {
    if (fromDir === toDir) {
      const record = await this.get(id);
      if (!record) {
        throw new Error(`Project not found: ${id}`);
      }
      return record;
    }
    const db = await this.getDB();
    const record = (await db.get(PROJECTS_STORE, id)) as ProjectRecord | undefined;
    if (!record) {
      throw new Error(`Project not found: ${id}`);
    }
    const names = record.manuscriptNames;
    const moved = names?.[fromDir];
    if (!names || moved === undefined) {
      return record;
    }
    const next: Record<string, string> = { ...names, [toDir]: moved };
    delete next[fromDir];
    const updated: ProjectRecord = { ...record, manuscriptNames: next };
    await db.put(PROJECTS_STORE, updated, id);
    return updated;
  }

  /**
   * Remove a project: deletes its record and meta, then destroys its
   * `od-ws-<id>` workspace database.
   * @param id - Project id.
   */
  async remove(id: string): Promise<void> {
    const db = await this.getDB();
    await db.delete(PROJECTS_STORE, id);
    await db.delete(META_STORE, id);
    await this.manager.destroy(id);
  }

  /**
   * Mark a project as opened now, moving it to the front of `list()`.
   * @param id - Project id.
   */
  async touch(id: string): Promise<void> {
    const db = await this.getDB();
    const record = (await db.get(PROJECTS_STORE, id)) as ProjectRecord | undefined;
    if (!record) {
      throw new Error(`Project not found: ${id}`);
    }
    await db.put(PROJECTS_STORE, { ...record, lastOpenedAt: nextTimestamp() }, id);
  }

  /**
   * Get the last opened file path for a project.
   * @param id - Project id.
   * @returns The stored path, or null if none was ever set.
   */
  async getLastPath(id: string): Promise<string | null> {
    const db = await this.getDB();
    const meta = (await db.get(META_STORE, id)) as ProjectMeta | undefined;
    return meta?.lastPath ?? null;
  }

  /**
   * Persist the last opened file path for a project.
   * @param id - Project id.
   * @param path - Repo-relative path of the file to remember.
   */
  async setLastPath(id: string, path: string): Promise<void> {
    const db = await this.getDB();
    await db.put(META_STORE, { lastPath: path } satisfies ProjectMeta, id);
  }

  /**
   * Close the registry database connection.
   * Call when the registry is no longer needed so deletion is not blocked.
   */
  async close(): Promise<void> {
    const db = await this.getDB();
    db.close();
  }
}

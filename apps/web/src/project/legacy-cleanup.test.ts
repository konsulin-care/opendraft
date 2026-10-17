import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { indexedDB } from 'fake-indexeddb';
import { cleanupLegacyDatabases } from './legacy-cleanup';

const FLAG = 'opendraft:legacy-cleaned';

/**
 * List database names reported by the given `databases()` implementation.
 *
 * @param databases - Function returning the database info list.
 * @returns Every non-empty database name.
 */
async function namesFrom(
  databases: () => Promise<Array<{ name?: string }>>,
): Promise<string[]> {
  const dbs = await databases();
  return dbs.map((db) => db.name).filter((name): name is string => Boolean(name));
}

/**
 * List the names of all currently existing IndexedDB databases.
 *
 * @returns Every database name reported by `indexedDB.databases()`.
 */
async function databaseNames(): Promise<string[]> {
  return namesFrom(() => indexedDB.databases());
}

/**
 * Create an (empty) IndexedDB database with the given name.
 *
 * @param name - Database name to create.
 * @returns A promise that resolves once the database exists.
 */
function createDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete an IndexedDB database by name.
 *
 * @param name - Database name to delete.
 * @returns A promise that resolves once the database is deleted.
 */
function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Remove every existing IndexedDB database.
 *
 * @returns A promise that resolves once no database remains.
 */
async function deleteAllDatabases(): Promise<void> {
  for (const name of await databaseNames()) {
    await deleteDatabase(name);
  }
}

describe('cleanupLegacyDatabases', () => {
  beforeEach(async () => {
    localStorage.clear();
    await deleteAllDatabases();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('deletes every opendraft-workspace-* database and keeps the rest', async () => {
    await createDatabase('opendraft-workspace-opendraft-manuscript');
    await createDatabase('opendraft-workspace-dev');
    await createDatabase('od-registry');

    await cleanupLegacyDatabases();

    expect(await databaseNames()).toEqual(['od-registry']);
    expect(localStorage.getItem(FLAG)).toBe('true');
  });

  it('deletes nothing on a second call once the flag is set', async () => {
    await createDatabase('opendraft-workspace-opendraft-manuscript');
    await cleanupLegacyDatabases();
    expect(localStorage.getItem(FLAG)).toBe('true');

    await createDatabase('opendraft-workspace-z');
    await cleanupLegacyDatabases();

    expect(await databaseNames()).toContain('opendraft-workspace-z');
  });

  it('deletes the legacy default database when indexedDB.databases is missing', async () => {
    const original = indexedDB.databases;
    // Simulate a browser without the databases() API.
    (indexedDB as { databases?: unknown }).databases = undefined;
    try {
      await createDatabase('opendraft-workspace-opendraft-manuscript');

      await cleanupLegacyDatabases();

      const names = await namesFrom(() => original.call(indexedDB));
      expect(names).not.toContain('opendraft-workspace-opendraft-manuscript');
      expect(localStorage.getItem(FLAG)).toBe('true');
    } finally {
      (indexedDB as { databases?: unknown }).databases = original;
    }
  });
});

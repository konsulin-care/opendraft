/** localStorage flag guarding the one-time legacy cleanup. */
export const LEGACY_CLEANED_FLAG = 'opendraft:legacy-cleaned';

/** Only databases with this prefix are considered legacy. */
const LEGACY_PREFIX = 'opendraft-workspace-';

/**
 * Legacy default database to delete when `indexedDB.databases()` is
 * unavailable (older browsers without the database-enumeration API).
 */
const LEGACY_FALLBACK_DB = 'opendraft-workspace-opendraft-manuscript';

/**
 * Delete legacy `opendraft-workspace-*` databases once on boot.
 *
 * Guarded by the localStorage flag `opendraft:legacy-cleaned`, so subsequent
 * calls are no-ops. When `indexedDB.databases()` is missing, the hard-coded
 * legacy default database is deleted instead. There is no data migration:
 * we start fresh.
 *
 * @returns A promise that resolves after cleanup completes (or is skipped).
 */
export async function cleanupLegacyDatabases(): Promise<void> {
  if (localStorage.getItem(LEGACY_CLEANED_FLAG)) {
    return;
  }
  const names = await listLegacyDatabaseNames();
  for (const name of names) {
    await deleteDatabase(name);
  }
  localStorage.setItem(LEGACY_CLEANED_FLAG, 'true');
}

/**
 * List the names of all legacy databases to delete.
 *
 * Uses `indexedDB.databases()` when available; falls back to the legacy
 * default database name otherwise.
 *
 * @returns Names of databases starting with `opendraft-workspace-`.
 */
async function listLegacyDatabaseNames(): Promise<string[]> {
  if (typeof indexedDB.databases === 'function') {
    const dbs = await indexedDB.databases();
    return dbs
      .map((db) => db.name)
      .filter((name): name is string => Boolean(name && name.startsWith(LEGACY_PREFIX)));
  }
  return [LEGACY_FALLBACK_DB];
}

/**
 * Delete an IndexedDB database by name.
 *
 * @param name - Full database name.
 * @returns A promise that resolves once the database is deleted.
 */
function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
}

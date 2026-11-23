import LightningFS from '@isomorphic-git/lightning-fs';

/** Prefix for the IndexedDB database name that backs a project repository. */
const DB_PREFIX = 'od-git-';

/** Internal lightning-fs promise API used to release resources after a wipe. */
interface DeactivatablePromises {
  _deactivate(): Promise<void>;
}

/**
 * Build the IndexedDB database name for a project.
 * @param projectId - Project identifier.
 * @returns The lightning-fs database name.
 */
function dbName(projectId: string): string {
  return `${DB_PREFIX}${projectId}`;
}

/**
 * Open the persistent IndexedDB-backed filesystem for a project.
 * Each project id maps to its own database, so repositories stay isolated.
 * @param projectId - Project identifier.
 * @returns A lightning-fs instance for the project repository.
 */
export function openProjectFs(projectId: string): LightningFS {
  return new LightningFS(dbName(projectId));
}

/**
 * Delete a project's persistent filesystem by wiping its IndexedDB database.
 * Resolves once the wipe has completed so callers can safely reopen the project.
 * @param projectId - Project identifier.
 * @returns A promise that resolves after the project database is wiped.
 */
export async function deleteProjectFs(projectId: string): Promise<void> {
  const fs = new LightningFS(dbName(projectId), { wipe: true });
  // A wrapped operation waits for the constructor's wipe to finish.
  await fs.promises.readdir('/');
  await (fs.promises as unknown as DeactivatablePromises)._deactivate();
}

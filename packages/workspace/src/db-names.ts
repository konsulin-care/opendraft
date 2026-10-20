/**
 * IndexedDB database naming for OpenDraft storage.
 *
 * Every project workspace gets its own database named `od-ws-<id>`,
 * and the shared project registry lives in the `od-registry` database.
 * The short `od-` prefix replaces the legacy `opendraft-workspace-` prefix.
 */

/** Name of the shared project registry database. */
export const REGISTRY_DB = 'od-registry';

/**
 * Compute the IndexedDB database name for a workspace.
 * @param id - Workspace (project) identifier, typically a UUID.
 * @returns The database name `od-ws-<id>`.
 */
export function workspaceDbName(id: string): string {
  return `od-ws-${id}`;
}

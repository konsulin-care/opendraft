/**
 * Purge private GitHub projects when the viewer is definitively signed out.
 *
 * A private suggestion clone must never stay visible to an anonymous viewer.
 * The session lookup is injected so the module stays unit-testable, and a
 * failed lookup (network error) never purges anything.
 */

import type { ProjectRecord } from '@opendraft/workspace';
import type { SessionState } from '../github/bff-client';

/** Registry operations needed to purge private projects. */
export interface PurgeRegistry {
  /** List every registered project. */
  list: () => Promise<ProjectRecord[]>;
  /** Remove a project and destroy its workspace. */
  remove: (id: string) => Promise<void>;
}

/**
 * Decide whether a project is a private GitHub-source project.
 *
 * @param record - Project record to inspect.
 * @returns True when the project came from a private GitHub repository.
 */
function isPrivateGitHubProject(record: ProjectRecord): boolean {
  return record.source.kind === 'github' && record.source.private;
}

/**
 * Remove every private GitHub-source project from the registry.
 *
 * Local projects and projects cloned from public repositories are kept.
 *
 * @param registry - Registry used to list and remove projects.
 * @returns The removed project records.
 */
export async function purgePrivateProjects(
  registry: PurgeRegistry,
): Promise<ProjectRecord[]> {
  const records = await registry.list();
  const purged = records.filter(isPrivateGitHubProject);
  for (const record of purged) {
    await registry.remove(record.id);
  }
  return purged;
}

/**
 * Purge private GitHub projects only when the viewer is definitively signed out.
 *
 * A session state with a session purges nothing. A state with `session: null`
 * (401 or login disabled) purges every private GitHub project. A thrown
 * session lookup is swallowed and purges nothing, so network errors never
 * destroy local state.
 *
 * @param getSessionState - Injected session lookup.
 * @param registry - Registry used to list and remove projects.
 * @returns The removed project records, empty when nothing was purged.
 */
export async function purgeIfSignedOut(
  getSessionState: () => Promise<SessionState>,
  registry: PurgeRegistry,
): Promise<ProjectRecord[]> {
  let state: SessionState;
  try {
    state = await getSessionState();
  } catch {
    return [];
  }
  if (state.session !== null) {
    return [];
  }
  return purgePrivateProjects(registry);
}

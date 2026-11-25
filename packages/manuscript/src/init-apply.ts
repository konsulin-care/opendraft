/**
 * Apply an initialization plan to a workspace.
 *
 * `applyPlan` is the write half of plan-first initialization. It verifies
 * the whole plan before touching the workspace so a rejected plan leaves
 * every file unchanged.
 */
import type { WorkspaceAdapter } from '@opendraft/workspace';
import type { InitPlan, PlannedFile } from './init-plan.js';
import { InitError } from './init-plan.js';
import { OPENDRAFT_CONFIG_PATH } from './scaffold.js';

/**
 * Ensure every create target is absent and every update target is the
 * project configuration file.
 *
 * @param ws - Workspace holding the project.
 * @param files - Planned file operations.
 * @throws {InitError} With code `exists` when a create target already exists.
 * @throws {InitError} With code `unknown-candidate` when an update targets
 *   anything other than `opendraft.yml`.
 */
async function verifyPlan(ws: WorkspaceAdapter, files: PlannedFile[]): Promise<void> {
  for (const file of files) {
    if (file.op === 'create') {
      if ((await ws.readFile(file.path)) !== null) {
        throw new InitError('exists', `${file.path} already exists`);
      }
      continue;
    }
    if (file.op === 'update' && file.path !== OPENDRAFT_CONFIG_PATH) {
      throw new InitError('unknown-candidate', `Only ${OPENDRAFT_CONFIG_PATH} can be updated`);
    }
  }
}

/**
 * Apply an initialization plan, creating files and updating the existing
 * `opendraft.yml` only when the configuration already exists.
 *
 * The plan is verified in full before any write: a create target that
 * already exists throws {@link InitError} with code `exists` and no file is
 * written. Updates are limited to `opendraft.yml`.
 *
 * @param ws - Workspace to write into.
 * @param plan - Initialization plan produced by `planInit`.
 */
export async function applyPlan(ws: WorkspaceAdapter, plan: InitPlan): Promise<void> {
  await verifyPlan(ws, plan.files);
  for (const file of plan.files) {
    await ws.writeFile(file.path, file.content);
  }
}

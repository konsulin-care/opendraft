import type { WorkspaceAdapter } from '@opendraft/workspace';
import { validateProjectStage } from './project-stage.js';
import type { Finding, ValidateOptions } from './types.js';

export type { Finding, ValidateOptions } from './types.js';

/**
 * Validate a project workspace.
 *
 * @param ws - Workspace to validate.
 * @param _options - Validation options.
 * @returns All findings from the executed stages.
 */
export async function validateProject(
  ws: WorkspaceAdapter,
  _options: ValidateOptions = {},
): Promise<Finding[]> {
  return [...(await validateProjectStage(ws))];
}

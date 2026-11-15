import type { WorkspaceAdapter } from '@opendraft/workspace';
import { validateProjectStage } from './project-stage.js';
import { validateManuscriptStage } from './manuscript-stage.js';
import { validateRdfStage } from './rdf-stage.js';
import type { RdfStageOptions } from './rdf-stage.js';
import type { Finding } from './types.js';

export { validateRdfStage } from './rdf-stage.js';
export type { RdfStageOptions } from './rdf-stage.js';

export { checkManuscriptAssembly } from './manuscript-stage.js';
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
  options: RdfStageOptions = {},
): Promise<Finding[]> {
  const project = await validateProjectStage(ws);
  const manuscript = await validateManuscriptStage(ws, options.release === true);
  return [...project, ...manuscript, ...(await validateRdfStage(ws, manuscript, options))];
}

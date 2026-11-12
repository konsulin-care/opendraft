import type { WorkspaceAdapter } from '@opendraft/workspace';
import {
  OPENDRAFT_CONFIG_PATH,
  SHARED_BIB_PATH,
  scaffoldProject as scaffoldWorkspace,
} from '@opendraft/manuscript';
import protocolManifest from '../../../../protocol/protocol.manifest.json' with { type: 'json' };

export { OPENDRAFT_CONFIG_PATH, SHARED_BIB_PATH };

/** Options for scaffolding a new project workspace. */
export interface ScaffoldOptions {
  /** Identifier for the initial manuscript (lowercase alphanumeric + hyphens). */
  manuscriptId: string;
}

/**
 * Scaffold a new project workspace with the repository's protocol block.
 *
 * Thin wrapper around the `@opendraft/manuscript` scaffold: it binds the
 * protocol block from protocol/protocol.manifest.json so app callers only
 * pass the manuscript id. See the package function for the file layout it
 * writes.
 *
 * @param ws - Workspace adapter to write into (in-place).
 * @param options - Scaffold options; see {@link ScaffoldOptions}.
 */
export async function scaffoldProject(ws: WorkspaceAdapter, options: ScaffoldOptions): Promise<void> {
  await scaffoldWorkspace(ws, {
    manuscriptId: options.manuscriptId,
    protocol: protocolManifest.protocol,
  });
}

import type { WorkspaceAdapter } from '@opendraft/workspace';
import { stringify } from 'yaml';
import { STARTER_REFERENCES_BIB, starterManuscriptFiles, todayIsoDate } from './templates.js';

/** Path of the project configuration file at the workspace root. */
export const OPENDRAFT_CONFIG_PATH = 'opendraft.yml';

/** Path of the shared bibliography for all manuscripts. */
export const SHARED_BIB_PATH = 'manuscripts/references.bib';

/** Protocol revision block written as `protocol` in opendraft.yml. */
export interface ProtocolBlock {
  /** Fixed protocol name (`opendraft`). */
  name: string;
  /** Full 40-character Git commit SHA of the protocol revision. */
  version: string;
  /** Canonical repository URL. */
  repository: string;
  /** Full 40-character Git commit SHA; must equal `version`. */
  commit: string;
}

/** Options for scaffolding a new project workspace. */
export interface ScaffoldOptions {
  /** Identifier for the initial manuscript (lowercase alphanumeric + hyphens). */
  manuscriptId: string;
  /** Protocol block copied verbatim into `opendraft.yml`. */
  protocol: ProtocolBlock;
}

/**
 * Scaffold a new project workspace.
 *
 * Writes a spec-conformant `opendraft.yml` whose protocol block is the one
 * passed in options, plus the manuscript layout under
 * `manuscripts/<manuscriptId>/`: a container `article.qmd` with no include
 * shortcodes and no starter block file under `blocks/`, the metadata files.
 * The shared `manuscripts/references.bib` is written only when missing.
 *
 * @param ws - Workspace adapter to write into (in-place).
 * @param options - Scaffold options; see {@link ScaffoldOptions}.
 */
export async function scaffoldProject(ws: WorkspaceAdapter, options: ScaffoldOptions): Promise<void> {
  const { manuscriptId, protocol } = options;
  const manuscriptPath = `manuscripts/${manuscriptId}`;

  const config = {
    protocol,
    manuscripts: [{ id: manuscriptId, path: manuscriptPath }],
  };
  await ws.writeFile(OPENDRAFT_CONFIG_PATH, stringify(config));

  for (const [file, content] of Object.entries(starterManuscriptFiles(todayIsoDate()))) {
    await ws.writeFile(`${manuscriptPath}/${file}`, content);
  }
  if ((await ws.readFile(SHARED_BIB_PATH)) === null) {
    await ws.writeFile(SHARED_BIB_PATH, STARTER_REFERENCES_BIB);
  }
}

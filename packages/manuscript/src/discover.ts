/**
 * Read-only discovery of an existing project's configuration and
 * manuscript folders.
 *
 * `discoverProject` loads `opendraft.yml` when present, validates it
 * against the OpenDraft schema, classifies every immediate subfolder of
 * `manuscripts/`, and reports registrable folders that the configuration
 * does not list. The check never writes to the workspace.
 */
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { validateOpendraft } from '@opendraft/schema';
import { parse } from 'yaml';
import type { ManuscriptCandidate } from './discover-candidate.js';
import { classifyCandidate } from './discover-candidate.js';
import { OPENDRAFT_CONFIG_PATH } from './scaffold.js';

/** Configuration state of a project discovered by the init flow. */
export type ConfigState = 'missing' | 'valid' | 'invalid';

/** Read-only discovery result for an existing project. */
export interface ProjectDiscovery {
  /** Whether `opendraft.yml` is absent, valid, or invalid. */
  config: ConfigState;
  /** Human-readable validation or parse errors; empty unless invalid. */
  configErrors: string[];
  /** Manuscript ids listed in the configuration. */
  listed: string[];
  /** Classified immediate subfolders of `manuscripts/`. */
  candidates: ManuscriptCandidate[];
  /** Registrable candidate ids absent from the configuration list. */
  unlisted: string[];
}

/** Directory holding every manuscript of a project. */
const MANUSCRIPTS_DIR = 'manuscripts';

/** Registration statuses the init flow is allowed to add. */
const REGISTRABLE = new Set(['valid', 'repairable']);

/**
 * Extract the immediate subfolder names of `manuscripts/` from a full file
 * listing. Files directly under `manuscripts/` yield no candidate.
 *
 * @param files - Repo-relative file paths.
 * @returns Sorted unique subfolder names.
 */
function manuscriptFolders(files: string[]): string[] {
  const prefix = `${MANUSCRIPTS_DIR}/`;
  const names = new Set<string>();
  for (const file of files) {
    if (!file.startsWith(prefix)) continue;
    const rest = file.slice(prefix.length);
    const slash = rest.indexOf('/');
    if (slash > 0) names.add(rest.slice(0, slash));
  }
  return [...names].sort();
}

/**
 * Read the manuscript ids declared in a parsed configuration object.
 *
 * @param config - Parsed `opendraft.yml` content.
 * @returns Declared ids in configuration order.
 */
function listedIds(config: unknown): string[] {
  if (typeof config !== 'object' || config === null) return [];
  const manuscripts = (config as { manuscripts?: unknown }).manuscripts;
  if (!Array.isArray(manuscripts)) return [];
  const ids: string[] = [];
  for (const entry of manuscripts) {
    if (typeof entry !== 'object' || entry === null) continue;
    const id = (entry as { id?: unknown }).id;
    if (typeof id === 'string') ids.push(id);
  }
  return ids;
}

/**
 * Load and validate the project configuration.
 *
 * @param ws - Workspace holding the project.
 * @returns Config state, error messages, and the declared manuscript ids.
 */
async function loadConfig(
  ws: WorkspaceAdapter,
): Promise<{ config: ConfigState; configErrors: string[]; listed: string[] }> {
  const raw = await ws.readFile(OPENDRAFT_CONFIG_PATH);
  if (raw === null) {
    return { config: 'missing', configErrors: [], listed: [] };
  }

  let parsed: unknown;
  try {
    parsed = parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { config: 'invalid', configErrors: [message], listed: [] };
  }

  const result = validateOpendraft(parsed);
  if (!result.valid) {
    const configErrors = result.errors.map((error) => `${error.path}: ${error.message}`);
    return { config: 'invalid', configErrors, listed: [] };
  }

  return { config: 'valid', configErrors: [], listed: listedIds(parsed) };
}

/**
 * Discover the configuration state and manuscript folders of a project.
 *
 * Candidate ids are the immediate subfolders of `manuscripts/`; files
 * directly under it (such as `references.bib`) are ignored. `unlisted`
 * holds registrable candidates whose id is absent from a valid config, and
 * is empty when the config is missing or invalid.
 *
 * @param ws - Workspace holding the project.
 * @returns The discovery result; see {@link ProjectDiscovery}.
 */
export async function discoverProject(ws: WorkspaceAdapter): Promise<ProjectDiscovery> {
  const { config, configErrors, listed } = await loadConfig(ws);
  const files = await ws.listAll();
  const ids = manuscriptFolders(files);

  const candidates = await Promise.all(
    ids.map((id) => classifyCandidate(ws, `${MANUSCRIPTS_DIR}/${id}`)),
  );

  const listedSet = new Set(listed);
  const unlisted =
    config === 'valid'
      ? candidates
          .filter((candidate) => REGISTRABLE.has(candidate.status) && !listedSet.has(candidate.id))
          .map((candidate) => candidate.id)
      : [];

  return { config, configErrors, listed, candidates, unlisted };
}

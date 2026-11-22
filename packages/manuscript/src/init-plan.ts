/**
 * Plan-first project initialization.
 *
 * `planInit` turns discovery plus user decisions into an ordered list of
 * file operations. It never writes to the workspace: `applyPlan` performs
 * the writes later. Plans only create files, except for a valid existing
 * `opendraft.yml`, which is updated in place by appending manuscript
 * entries while preserving the protocol block and existing entries.
 */
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { parse, stringify } from 'yaml';
import type { CandidateWarning, ManuscriptCandidate } from './discover-candidate.js';
import type { ProjectDiscovery } from './discover.js';
import { isValidManuscriptId } from './manuscript-id.js';
import type { ProtocolBlock } from './scaffold.js';
import { OPENDRAFT_CONFIG_PATH, SHARED_BIB_PATH } from './scaffold.js';
import { STARTER_REFERENCES_BIB, starterManuscriptFiles, todayIsoDate } from './templates.js';

/** User decisions that drive the initialization plan. */
export interface InitDecisions {
  register?: string[];
  newManuscriptId?: string;
  addUnlisted?: string[];
}

/** One file operation in an initialization plan. */
export interface PlannedFile {
  path: string;
  content: string;
  op: 'create' | 'update';
  reason: string;
}

/** Result of planning an initialization. */
export interface InitPlan {
  files: PlannedFile[];
  registered: string[];
  warnings: Array<{ id: string; warning: CandidateWarning }>;
}

/** Error codes raised by the initialization planner. */
export type InitErrorCode = 'invalid-config' | 'invalid-id' | 'unknown-candidate' | 'exists';

/** Error raised when init decisions cannot be planned. */
export class InitError extends Error {
  /** Machine-readable failure category. */
  readonly code: InitErrorCode;

  /**
   * Create an initialization error.
   *
   * @param code - Machine-readable failure category.
   * @param message - Human-readable explanation.
   */
  constructor(code: InitErrorCode, message: string) {
    super(message);
    this.name = 'InitError';
    this.code = code;
  }
}

/** File operation input collected while planning. */
type FileDraft = { path: string; content: string; op: 'create' | 'update'; reason: string };

/** Manuscript entry written into `opendraft.yml`. */
interface ConfigEntry {
  id: string;
  path: string;
}

/** Mutable state accumulated while building a plan. */
interface PlanState {
  files: FileDraft[];
  registered: string[];
  warnings: Array<{ id: string; warning: CandidateWarning }>;
  entries: ConfigEntry[];
  added: string[];
  configured: Set<string>;
}

/** Parse an existing valid `opendraft.yml`. */
async function readExistingConfig(ws: WorkspaceAdapter): Promise<Record<string, unknown> | null> {
  const raw = await ws.readFile(OPENDRAFT_CONFIG_PATH);
  if (raw === null) return null;
  const parsed: unknown = parse(raw);
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : null;
}

/** Read the existing manuscript entries of a parsed configuration. */
function existingEntries(config: Record<string, unknown> | null): ConfigEntry[] {
  if (config === null || !Array.isArray(config.manuscripts)) return [];
  return config.manuscripts.flatMap((entry) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const id = (entry as { id?: unknown }).id;
    const path = (entry as { path?: unknown }).path;
    return typeof id === 'string' ? [{ id, path: typeof path === 'string' ? path : `manuscripts/${id}` }] : [];
  });
}

/** Collect unique manuscript ids from the register and addUnlisted decisions. */
function requestedIds(decisions: InitDecisions): string[] {
  const ids = [...(decisions.register ?? []), ...(decisions.addUnlisted ?? [])];
  return [...new Set(ids)];
}

/** Create a file draft for one starter manuscript file. */
function starterDraft(id: string, file: string, content: string, reason: string): FileDraft {
  return { path: `manuscripts/${id}/${file}`, content, op: 'create', reason };
}

/** Build the `opendraft.yml` draft when the plan changes the configuration. */
async function planConfig(
  ws: WorkspaceAdapter,
  discovery: ProjectDiscovery,
  state: PlanState,
  protocol: ProtocolBlock,
): Promise<FileDraft | null> {
  if (discovery.config === 'missing') {
    return {
      path: OPENDRAFT_CONFIG_PATH,
      content: stringify({ protocol, manuscripts: state.entries }),
      op: 'create',
      reason: 'write project configuration',
    };
  }
  if (state.added.length === 0) return null;
  const existing = await readExistingConfig(ws);
  const updated = {
    ...(existing ?? { protocol }),
    protocol: existing?.protocol ?? protocol,
    manuscripts: state.entries,
  };
  return {
    path: OPENDRAFT_CONFIG_PATH,
    content: stringify(updated),
    op: 'update',
    reason: `register ${state.added.join(', ')} in project configuration`,
  };
}

/** Validate requested ids and the optional new manuscript id. */
function validateDecisions(
  discovery: ProjectDiscovery,
  ids: string[],
  newId: string | undefined,
  byId: Map<string, ManuscriptCandidate>,
): void {
  for (const id of ids) {
    const candidate = byId.get(id);
    if (candidate === undefined || (candidate.status !== 'valid' && candidate.status !== 'repairable')) {
      throw new InitError('unknown-candidate', `Unknown or unregistrable candidate "${id}"`);
    }
  }
  if (newId === undefined) return;
  if (!isValidManuscriptId(newId)) {
    throw new InitError('invalid-id', `Invalid manuscript id "${newId}"`);
  }
  if (byId.has(newId) || discovery.listed.includes(newId)) {
    throw new InitError('exists', `Manuscript "${newId}" already exists`);
  }
}

/** Build the initial plan state from any existing configuration. */
async function createPlanState(ws: WorkspaceAdapter, discovery: ProjectDiscovery): Promise<PlanState> {
  const currentConfig = await readExistingConfig(ws);
  const entries = existingEntries(currentConfig);
  if (entries.length === 0 && discovery.config === 'valid') {
    for (const id of discovery.listed) entries.push({ id, path: `manuscripts/${id}` });
  }
  return {
    files: [],
    registered: [],
    warnings: [],
    entries,
    added: [],
    configured: new Set(entries.map((entry) => entry.id)),
  };
}

/** Append a manuscript entry once, tracking it as newly added. */
function addEntry(state: PlanState, id: string): void {
  if (state.configured.has(id)) return;
  state.configured.add(id);
  state.entries.push({ id, path: `manuscripts/${id}` });
  state.added.push(id);
}

/** Register one candidate and collect its warnings. */
function registerCandidate(state: PlanState, id: string, candidate: ManuscriptCandidate): void {
  addEntry(state, id);
  state.registered.push(id);
  for (const warning of candidate.warnings) state.warnings.push({ id, warning });
}

/** Add starter files that repair missing metadata for repairable candidates. */
function addRepairFiles(
  state: PlanState,
  ids: string[],
  byId: Map<string, ManuscriptCandidate>,
  starter: Record<string, string>,
): void {
  for (const id of ids) {
    const candidate = byId.get(id);
    if (candidate === undefined || candidate.status !== 'repairable') continue;
    for (const file of candidate.missingFiles) {
      const content = starter[file];
      if (content !== undefined) {
        state.files.push(starterDraft(id, file, content, `create missing metadata ${file}`));
      }
    }
  }
}

/** Add the starter files for a brand new manuscript. */
function addNewManuscript(state: PlanState, id: string, starter: Record<string, string>): void {
  addEntry(state, id);
  state.registered.push(id);
  for (const [file, content] of Object.entries(starter)) {
    state.files.push(starterDraft(id, file, content, 'create starter manuscript file'));
  }
}

/**
 * Plan project initialization from discovery and user decisions.
 *
 * Register ids must exist as `valid` or `repairable` candidates; anything
 * else throws {@link InitError} with code `unknown-candidate`. A new
 * manuscript id must satisfy `isValidManuscriptId`, otherwise the plan
 * throws with code `invalid-id`. The plan creates missing metadata starter
 * files for repairable candidates, the brand new manuscript files, and the
 * shared bibliography when absent. An invalid existing configuration stops
 * the flow with code `invalid-config` and is never rewritten.
 *
 * @param ws - Workspace holding the project.
 * @param discovery - Read-only discovery result for the project.
 * @param decisions - Ids to register and/or a new manuscript id.
 * @param options - Protocol block for a new or updated configuration.
 * @returns The initialization plan; see {@link InitPlan}.
 */
export async function planInit(
  ws: WorkspaceAdapter,
  discovery: ProjectDiscovery,
  decisions: InitDecisions,
  options: { protocol: ProtocolBlock },
): Promise<InitPlan> {
  if (discovery.config === 'invalid') {
    throw new InitError('invalid-config', `Invalid ${OPENDRAFT_CONFIG_PATH}: ${discovery.configErrors.join('; ')}`);
  }

  const byId = new Map(discovery.candidates.map((candidate) => [candidate.id, candidate]));
  const ids = requestedIds(decisions);
  const newId = decisions.newManuscriptId;
  validateDecisions(discovery, ids, newId, byId);

  const state = await createPlanState(ws, discovery);
  const starter = starterManuscriptFiles(todayIsoDate());

  for (const id of ids) registerCandidate(state, id, byId.get(id) as ManuscriptCandidate);
  addRepairFiles(state, ids, byId, starter);
  if (newId !== undefined) addNewManuscript(state, newId, starter);

  if (discovery.config === 'missing' || state.added.length > 0) {
    const config = await planConfig(ws, discovery, state, options.protocol);
    if (config !== null) state.files.unshift(config);
  }

  if ((await ws.readFile(SHARED_BIB_PATH)) === null) {
    state.files.push({
      path: SHARED_BIB_PATH,
      content: STARTER_REFERENCES_BIB,
      op: 'create',
      reason: 'create shared bibliography',
    });
  }

  return { files: state.files, registered: state.registered, warnings: state.warnings };
}

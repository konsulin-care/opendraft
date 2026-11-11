export type { WorkspaceAdapter } from './adapter.js';
export { withLogging } from './logging.js';
export type { WorkspaceLogger } from './logging.js';
export { MemoryWorkspace } from './memory.js';
export { IndexedDBWorkspace } from './indexeddb.js';
export { WorkspaceManager, workspaceManager } from './manager.js';
export { ProjectRegistry } from './registry.js';
export type {
  ProjectRecord,
  ProjectSource,
  ProjectSourceLocal,
  ProjectSourceGitHub,
} from './registry.js';
export { REGISTRY_DB, workspaceDbName } from './db-names.js';

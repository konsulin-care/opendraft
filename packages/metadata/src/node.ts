/**
 * Node-only entry for `@opendraft/metadata`.
 *
 * Isolated from the aggregate `index.ts` because these modules import
 * `node:fs`, `node:path` and `node:crypto`, which Vite externalizes in the
 * browser and throws on at module evaluation. Browser-safe modules must
 * import from the aggregate entry (`@opendraft/metadata`) instead.
 */

export { compileManuscript } from './compiler.js';
export type { PublicationMetadata } from './compiler.js';
export { migrateToBlockLayout } from './migration.js';
export type { MigrationResult } from './migration.js';
